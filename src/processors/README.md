# Processors
Processors are a collection of methods meant to prepare the script for obfuscation, removing anti-debugging traps
and performing any required modifications before (preprocessors) or after (postprocessors) the main deobfuscation process.

The processors are created when necessary and are lazily loaded when a specific obfuscation type was detected
which requires these additional processes.

The mapping of obfuscation type to their processors can be found in the [index.js](index.js) file.

## Available Processors
Processor specifics can always be found in comments in the code.
* [Caesar Plus](src/processors/caesarp.js) <br/> 
  A description of the obfuscator and the deobfuscating process can be found [here](https://www.perimeterx.com/tech-blog/2020/deobfuscating-caesar/). <br/>
  - Preprocessor:
    - Unwraps the outer layer.
  - Postprocessor: 
    - Removes dead code.
* [Augmented Arrays](src/processors/augmentedArray.js) <br/> 
  - Preprocessor:
    - Augments the array once to avoid repeating the same action.
* [Obfuscator.io](src/processors/obfuscator.io.js) <br/> 
  - Preprocessor:
    - Removes anti-debugging embedded in the code, and applies the augmented array processors.
* [Function to Array](src/processors/functionToArray.js) <br/> 
  - Preprocessor:
    - Generates the array from the function once to avoid repeating the same action.