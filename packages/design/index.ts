import {command, run, string as str, positional, option} from 'cmd-ts';
import {globSync} from "glob";
import {mermaidToScaffold} from "./src/scaffold";
import {readFileSync} from "node:fs";

const cmd = command({
    name: 'mm2ws',
    description: 'Parses a Mermaid State Diagram to a Gamgee Workflow Scaffold',
    version: '0.0.0',
    args: {
        sources: positional({
            type: str,
            displayName: 'sources',
            description: 'A glob of where to find the Mermaid sources.'
        }),
        implementationRelativePath: option({
            type: str,
            long: 'implementation-relative-path',
            short: 'irpath',
            description: 'The location of the implementation sources when looking for them from the scaffold.',
            defaultValue(): string {
                return '.';
            }
        }),
        
        // TODO: Generate test utils
    },
    handler: (args) => {
        const mermaidFiles = globSync(args.sources);

        for (const mermaidFile of mermaidFiles) {
            console.log(`Converting ${mermaidFile}...`)
            const contents = readFileSync(mermaidFile, { encoding: 'utf8' });
            mermaidToScaffold(contents, args.implementationRelativePath)
            console.log(`Done converting ${mermaidFile}.`)
        }
    },
});

run(cmd, process.argv.slice(2));
