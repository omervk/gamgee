import { mermaidToScaffold } from '../src/scaffold'
import { readFileSync } from 'node:fs'
import { expect } from '@jest/globals'

describe('test generated scaffolds', () => {
    const tests = ['simple-workflow', 'conditions', 'out-of-order']

    tests.forEach(testName => {
        it.concurrent(`test ${testName}.mermaid`, () => {
            const { generatedFilePath, contents } = mermaidToScaffold(
                readFileSync(`./test/resources/${testName}.mermaid`, { encoding: 'utf8' }),
                `./${testName}.ts`,
                '.',
            )
            expect(generatedFilePath).toStrictEqual(`${testName}.generated.ts`)
            expect(contents).toStrictEqual(
                readFileSync(`./test/resources/${testName}.generated.ts`, { encoding: 'utf8' }),
            )
        })
    })
})
