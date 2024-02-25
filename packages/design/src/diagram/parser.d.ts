export type DirStatement = { stmt: 'dir'; value: 'TB' | 'BT' | 'LR' | 'RL' }
export type StateStatement = {
    stmt: 'state'
    id: string
    type: 'default' | 'choice' | 'fork' | 'join' | 'divider'
    classes?: string[]
    description?: string
    doc?: string
    note?: { position: string; text: string }
}
export type RelationStatement = {
    stmt: 'relation'
    state1: { id: string }
    state2: { id: string }
    description?: string
}
export type ClassDefStatement = { stmt: 'classDef'; id: string; classes: string[] }
export type ApplyClassStatement = { stmt: 'applyClass'; id: string; styleClass: string }
export type Statement = DirStatement | StateStatement | RelationStatement | ClassDefStatement | ApplyClassStatement

export interface YY {
    getDividerId: () => string
    setAccTitle: (string) => void
    setAccDescription: (string) => void
    setDirection: (string) => void
    setRootDoc: (string) => void
    trimColon: (string) => string
}

export const parser: {
    yy: YY
    parse: (string) => Statement[]
}
