import {getDescendants} from '../utils/getDescendants.js';

const maxRepetition = 50;

/**
 * Find switch statements that can be linearized into sequential code.
 * 
 * Identifies switch statements that use a discriminant variable which:
 * - Is an identifier with literal initialization
 * - Has deterministic flow through cases via assignments
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {ASTNode[]} Array of matching switch statement nodes
 */
export function rearrangeSwitchesMatch(arb, candidateFilter = () => true) {
	const relevantNodes = arb.ast[0].typeMap.SwitchStatement;
	const matchingNodes = [];
	
	for (let i = 0; i < relevantNodes.length; i++) {
		const n = relevantNodes[i];
		// Check if switch discriminant is an identifier with literal initialization
		if (n.discriminant.type === 'Identifier' &&
			n?.discriminant.declNode?.parentNode?.init?.type === 'Literal' &&
			candidateFilter(n)) {
			matchingNodes.push(n);
		}
	}
	return matchingNodes;
}

/**
 * Transform a switch statement into a sequential block of statements.
 * 
 * Algorithm:
 * 1. Start with the initial discriminant value from variable initialization
 * 2. Find the matching case (or default case) for current value
 * 3. Collect all statements from that case (except break statements)
 * 4. Look for assignments to the discriminant variable to find next case
 * 5. Repeat until no more valid transitions found or max iterations reached
 * 6. Replace switch with sequential block of collected statements
 * 
 * @param {Arborist} arb
 * @param {Object} switchNode - The switch statement node to transform
 * @return {Arborist}
 */
export function rearrangeSwitchesTransform(arb, switchNode) {
	const ordered = [];
	const cases = switchNode.cases;
	let currentVal = switchNode.discriminant.declNode.parentNode.init.value;
	let counter = 0;
	
	// Trace execution path through switch cases
	while (currentVal !== undefined && counter < maxRepetition) {
		// Find the matching case for current value (or default case)
		let currentCase;
		for (let i = 0; i < cases.length; i++) {
			if (cases[i].test?.value === currentVal || !cases[i].test) {
				currentCase = cases[i];
				break;
			}
		}
		if (!currentCase) break;
		
		// Collect all statements from this case (except break statements)
		for (let i = 0; i < currentCase.consequent.length; i++) {
			if (currentCase.consequent[i].type !== 'BreakStatement') {
				ordered.push(currentCase.consequent[i]);
			}
		}
		
		// Find assignments to discriminant variable to determine next case
		let allDescendants = [];
		for (let i = 0; i < currentCase.consequent.length; i++) {
			allDescendants.push(...getDescendants(currentCase.consequent[i]));
		}
		
		// Look for assignments to the switch discriminant variable
		const assignments2Next = allDescendants.filter(d => 
			d.declNode === switchNode.discriminant.declNode &&
			d.parentKey === 'left' &&
			d.parentNode.type === 'AssignmentExpression'
		);
		
		if (assignments2Next.length === 1) {
			// Single assignment found - use its value for next iteration
			currentVal = assignments2Next[0].parentNode.right.value;
		} else {
			// Multiple or no assignments - can't determine next case reliably
			currentVal = undefined;
		}
		++counter;
	}
	
	// Replace switch with sequential block if we collected any statements
	if (ordered.length) {
		arb.markNode(switchNode, {
			type: 'BlockStatement',
			body: ordered,
		});
	}
	return arb;
}

/**
 * Rearrange switch statements with deterministic flow into sequential code blocks.
 * 
 * Converts switch statements that use a control variable to sequence operations
 * into a linear sequence of statements. This is commonly seen in obfuscated code
 * where a simple sequence of operations is disguised as a switch statement.
 * 
 * Example transformation:
 *   var state = 0;
 *   switch (state) {
 *     case 0: doFirst(); state = 1; break;
 *     case 1: doSecond(); state = 2; break;
 *     case 2: doThird(); break;
 *   }
 * 
 * Becomes:
 *   doFirst();
 *   doSecond(); 
 *   doThird();
 * 
 * @param {Arborist} arb
 * @param {Function} candidateFilter (optional) a filter to apply on the candidates list
 * @return {Arborist}
 */
export default function rearrangeSwitches(arb, candidateFilter = () => true) {
	const matchingNodes = rearrangeSwitchesMatch(arb, candidateFilter);
	for (let i = 0; i < matchingNodes.length; i++) {
		arb = rearrangeSwitchesTransform(arb, matchingNodes[i]);
	}
	return arb;
}