function recordReportRequest(trace, { provider, model, kind = 'initial', startedAt, response, error }) {
  if (!trace) return;
  const data = response || error?.response?.data;
  trace.requests = trace.requests || [];
  trace.requests.push({
    kind,
    provider,
    model,
    started_at: startedAt,
    completed_at: new Date(),
    status: error ? 'failed' : 'completed',
    request_id: data?.id,
    stop_reason: data?.stop_reason || data?.choices?.[0]?.finish_reason,
    usage: data?.usage || null,
    error: error?.message
  });
}

module.exports = { recordReportRequest };
