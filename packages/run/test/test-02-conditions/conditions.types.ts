export type DecidePayload = {
    testId: string
    choose: 'left' | 'right'
    failuresRequested: {
        decideFailures: number
        leftFailures: number
        rightFailures: number
    }
}

export type LeftPayload = {
    testId: string
    failuresRequested: number
}

export type RightPayload = LeftPayload
