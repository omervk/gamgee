import {mermaidToScaffold} from "../src/scaffold";

const fileText: string = `
---
# Required - the name of the workflow
title: Example Workflow
---

stateDiagram-v2
    direction LR

    state POST_FIRST_TASK <<choice>>

    [*] --> first_task
    first_task --> first_task: attempts=3
    first_task --> POST_FIRST_TASK
    POST_FIRST_TASK --> SecondTask: Value Is Null
    SecondTask --> SecondTask: attempts=2\\nbackoffMs=2000
    POST_FIRST_TASK --> thirdTask: Value Isn't Null
    SecondTask --> thirdTask
    thirdTask --> [*]
`;

describe('test', () => {
    it('test', () => {
        const {generatedFilePath, contents} = mermaidToScaffold(fileText, "./my-file.ts", ".");
        console.log(generatedFilePath);
        console.log(contents);
    })
});