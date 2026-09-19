/** HTTP 契约只包含可序列化数据，浏览器与服务端共用。 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; requestId: string } };

export type HealthStatus = {
  application: "ready";
  integrations: {
    database: "not_connected";
    ai: "not_connected";
  };
};
