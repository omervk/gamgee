import { ExportResult, ExportResultCode } from '@opentelemetry/core'
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'

export class TestsTraceExporter implements SpanExporter {
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
