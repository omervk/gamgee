import { RelationStatement, Statement, StateStatement } from './diagram/parser'
import findDirectedCycle from 'find-cycle/directed'

export type StateNode = {
    type: 'State'
    name: string
    attributes: { [name: string]: string }
    knownAttributes: { attempts?: number; backoffMs?: number }
    goesTo: Node[]
}
export type ChoiceNode = { type: 'Choice'; name: string; goesTo: { [relationName: string]: StateNode } }

export type Node = StateNode | ChoiceNode

export const StartStateName = '[*]'
export const EndStateName = '[*]'

function bootstrapChoices(supportedDiagramStatements: Statement[]): { [name: string]: ChoiceNode } {
    return Object.fromEntries(
        supportedDiagramStatements
            .filter(s => s.stmt === 'state' && s.type === 'choice')
            .map(s => [(s as StateStatement).id, { type: 'Choice', name: (s as StateStatement).id, goesTo: {} }]),
    )
}

function collectStates(supportedDiagramStatements: Statement[], choices: { [p: string]: ChoiceNode }) {
    const states: { [name: string]: StateNode } = {}

    for (const statement of supportedDiagramStatements.filter(({ stmt }) => stmt === 'relation')) {
        const relation = statement as RelationStatement
        const from = relation.state1.id
        const to = relation.state2.id

        if (!choices[from]) {
            states[from] ??= {
                type: 'State',
                name: from,
                attributes: {},
                knownAttributes: {},
                goesTo: [],
            }
        }

        if (!choices[to]) {
            states[to] ??= {
                type: 'State',
                name: to,
                attributes: {},
                knownAttributes: {},
                goesTo: [],
            }
        }
    }

    return states
}

function addRelations(
    relations: RelationStatement[],
    states: { [name: string]: StateNode },
    choices: { [name: string]: ChoiceNode },
) {
    const errors: string[] = []

    for (const relation of relations) {
        const from: string = relation.state1.id,
            to: string = relation.state2.id
        const fromChoice: ChoiceNode | undefined = choices?.[from],
            toChoice: ChoiceNode | undefined = choices?.[to]
        const fromState: StateNode | undefined = states?.[from],
            toState: StateNode | undefined = states?.[to]

        if (from === to) {
            if (from === StartStateName) {
                errors.push('The start and end states may not have self-arrows or be linked directly to each other.')
                continue
            }

            if (fromChoice) {
                errors.push(`Decisions may not have self-arrows. The decision ${from} connects to itself.`)
                continue
            }

            if (relation.description === undefined) {
                errors.push(
                    `Self-arrows must include information about retries. The self-arrow on ${from} provides no information.`,
                )
                continue
            }

            // Note: The parser escapes backslashes
            const parsedPairs: [string, string][] = relation.description
                .replace('\\n', '\n')
                .split('\n')
                .map(s => s.split('='))
                .filter(arr => arr.length === 2)
                .map(([k, v]) => [k, v])

            fromState.attributes = Object.assign({}, fromState.attributes, Object.fromEntries<string>(parsedPairs))
        } else if (fromChoice) {
            if (toChoice) {
                errors.push(
                    `A decision can not be directly connected to another decision. There is a connection between ${from} and ${to}.`,
                )
                continue
            }

            if (!toState) {
                errors.push(
                    `Internal error: Expected choice ${from} to be connected to state ${to} but couldn't find the state.`,
                )
                continue
            }

            if (!relation.description) {
                errors.push(
                    `All relations coming out of decisions must be named. The relation from ${from} to ${to} is unnamed.`,
                )
                continue
            }

            if (fromChoice.goesTo[relation.description]) {
                errors.push(
                    `More than one relation coming out of ${from} is named ${relation.description}. Relation names must be unique for each source.`,
                )
                continue
            }

            fromChoice.goesTo[relation.description] = toState
        } else if (fromState) {
            if (!toChoice && !toState) {
                errors.push(
                    `Internal error: Expected state ${from} to be connected to state/choice ${to} but can't find either destination.`,
                )
                continue
            }

            fromState.goesTo.push(toChoice || toState)
        } else {
            errors.push(`Internal error: Expected ${from} to be either a state or a choice, but can't find either.`)
        }
    }

    return errors
}

// TODO: Validate names are valid identifiers, too
function validateStates(states: { [name: string]: StateNode }) {
    const errors: string[] = []

    if (Object.keys(states).length === 0) {
        errors.push(`Diagram is empty of states.`)
    }

    for (const [name, state] of Object.entries(states)) {
        if (state.goesTo.length === 0) {
            if (state.name === StartStateName) {
                errors.push('Unable to determine any step being the first, with a relation coming from [*].')
            } else {
                errors.push(
                    `The state ${name} has no outgoing connection and must be connected to the end state ${EndStateName} explicitly.`,
                )
            }
        } else if (state.goesTo.length > 1) {
            // This will be gone when fork/join is introduced
            errors.push(
                `Only one relation may leave a non-decision step. The step ${name} has outgoing arrows to the steps ${state.goesTo.map(s => s.name).join(', ')}.`,
            )
        }

        if (state.attributes['attempts']) {
            const attempts = Number.parseFloat(state.attributes['attempts'])

            if (Number.isNaN(attempts)) {
                errors.push(
                    `Number of attempts for ${name} is '${state.attributes['attempts']}', which is not a number. Only whole positive numbers are allowed.`,
                )
            } else if (attempts <= 0 || Math.floor(attempts) !== attempts) {
                errors.push(`Number of attempts for ${name} is ${attempts}. Only whole positive numbers are allowed.`)
            } else {
                state.knownAttributes.attempts = attempts
            }
        }

        if (state.attributes['backoffMs']) {
            const backoffMs = Number.parseFloat(state.attributes['backoffMs'])

            if (Number.isNaN(backoffMs)) {
                errors.push(
                    `backoffMs for ${name} is '${state.attributes['backoffMs']}', which is not a number. Only whole positive numbers are allowed.`,
                )
            } else if (backoffMs <= 0 || Math.floor(backoffMs) !== backoffMs) {
                errors.push(`backoffMs for ${name} is ${backoffMs}. Only whole positive numbers are allowed.`)
            } else {
                state.knownAttributes.backoffMs = backoffMs
            }
        }

        const unknownAttributes = Object.keys(state.attributes).filter(key => !['attempts', 'backoffMs'].includes(key))

        if (unknownAttributes.length > 0) {
            errors.push(`Unknown attributes ${unknownAttributes.join(', ')} on ${name}.`)
        }
    }

    return errors
}

function findFirstCycle(
    states: { [name: string]: StateNode },
    choices: { [name: string]: ChoiceNode },
): string[] | null {
    const stateConnections: [string, string[]][] = Object.keys(states).map(name => [
        name,
        states[name].goesTo.map(gt => gt.name),
    ])
    const choiceConnections: [string, string[]][] = Object.keys(choices).map(name => [
        name,
        Object.values(choices[name].goesTo).map(({ name }) => name),
    ])
    const sourceTargets: { [name: string]: string[] } = Object.fromEntries(
        [...stateConnections, ...choiceConnections].map(([source, targets]) => [
            source,
            // Filter out the end state so that we don't accidentally find a cycle with [*] that is both the start and the end
            targets.filter(t => t !== EndStateName),
        ]),
    )

    return findDirectedCycle([StartStateName], name => sourceTargets[name] || []) || null
}

export function statementsToGraph(diagramStatements: Statement[]): {
    choices: { [name: string]: ChoiceNode }
    states: { [name: string]: StateNode }
} {
    const supportedDiagramStatements = diagramStatements.filter(statement => {
        if ((statement.stmt === 'state' && statement.type === 'choice') || statement.stmt === 'relation') {
            return true
        }

        console.log(`Ignoring unsupported statement: ${JSON.stringify(statement)}`)
        return false
    })

    const choices: { [name: string]: ChoiceNode } = bootstrapChoices(supportedDiagramStatements)
    const states: { [name: string]: StateNode } = collectStates(supportedDiagramStatements, choices)

    const relationErrors = addRelations(
        supportedDiagramStatements.filter(s => s.stmt === 'relation').map(s => s as RelationStatement),
        states,
        choices,
    )

    if (relationErrors.length > 0) {
        throw new Error(
            `Found errors while parsing the diagram's relations:${relationErrors.map(e => `\n* ${e}`).join('')}`,
        )
    }

    const validationErrors = validateStates(states)

    if (validationErrors.length > 0) {
        throw new Error(`Found errors while validating the diagram:${validationErrors.map(e => `\n* ${e}`).join('')}`)
    }

    const cycle = findFirstCycle(states, choices)

    if (cycle) {
        throw new Error(
            `The state diagram must be a directed acyclic graph (DAG), but found a cycle: ${cycle.join(' --> ')} --> ${cycle[0]}.`,
        )
    }

    return { states, choices }
}
