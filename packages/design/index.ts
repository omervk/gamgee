import {command, run, string as str, positional, option} from 'cmd-ts';
import {globSync} from "glob";
import {mermaidToScaffold} from "./src/scaffold";
import {readFileSync, writeFileSync} from "node:fs";
import * as path from "path";

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

        for (const mermaidFilePath of mermaidFiles) {
            console.log(`Converting ${mermaidFilePath}...`)
            const mermaidContents = readFileSync(mermaidFilePath, { encoding: 'utf8' });
            const { generatedFilePath, contents} = mermaidToScaffold(mermaidContents, mermaidFilePath, args.implementationRelativePath);
            console.log(`Writing ${generatedFilePath}...`)
            writeFileSync(generatedFilePath, contents)
        }
    },
});

run(cmd, process.argv.slice(2));