import { ExportResult, ExportResultCode } from '@opentelemetry/core'
import { ReadableSpan, SimpleSpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-base'

class TestsTraceExporter implements SpanExporter {
    private readonly spansByTraceId: { [traceId: string]: (ReadableSpan & { spanId: string })[] } = {}

    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
        for (const span of spans) {
            const traceId = span.spanContext().traceId
            this.spansByTraceId[traceId] ??= []
            this.spansByTraceId[traceId].push(Object.assign({ spanId: span.spanContext().spanId }, span))
        }

        resultCallback({ code: ExportResultCode.SUCCESS })
    }

    shutdown(): Promise<void> {
        return Promise.resolve()
    }

    forceFlush?(): Promise<void> {
        return Promise.resolve()
    }

    getSpansByTraceId(traceId: string): (ReadableSpan & { spanId: string })[] {
        return this.spansByTraceId[traceId] || []
    }
}

export class TracedTestsSpanProcessor extends SimpleSpanProcessor {
    readonly exporter: TestsTraceExporter

    constructor() {
        const exporter = new TestsTraceExporter()
        super(exporter)
        this.exporter = exporter
    }

    getSpansByTraceId(traceId: string): (ReadableSpan & { spanId: string })[] {
        return this.exporter.getSpansByTraceId(traceId)
    }
}