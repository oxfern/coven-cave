type DataHandler = (bytes: Uint8Array) => void;
type ExitHandler = (code: number) => void;

export class PtyWsBridge {
  private ws: WebSocket | null = null;
  private dataHandlers: DataHandler[] = [];
  private exitHandlers: ExitHandler[] = [];

  onData(cb: DataHandler): void {
    this.dataHandlers.push(cb);
  }

  onExit(cb: ExitHandler): void {
    this.exitHandlers.push(cb);
  }

  connect(threadId: string, cols: number, rows: number, projectRoot?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const params = new URLSearchParams({
        threadId,
        cols: String(cols),
        rows: String(rows),
      });
      if (projectRoot) {
        params.set("projectRoot", projectRoot);
      }

      const url = `${proto}//${window.location.host}/api/pty-ws?${params}`;
      const ws = new WebSocket(url);
      let settled = false;
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.addEventListener("open", () => {
        settled = true;
        resolve();
      });
      ws.addEventListener("error", (event) => {
        if (!settled) {
          settled = true;
          reject(event);
        }
      });
      ws.addEventListener("message", (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const buf = new Uint8Array(event.data);
        const tag = buf[0];
        if (tag === 0x01) {
          const payload = buf.slice(1);
          for (const cb of this.dataHandlers) cb(payload);
        } else if (tag === 0x02 && buf.length >= 5) {
          const view = new DataView(event.data, 1);
          const code = view.getInt32(0, true);
          for (const cb of this.exitHandlers) cb(code);
        }
      });
      ws.addEventListener("close", () => {
        if (this.ws === ws) {
          this.ws = null;
        }
      });
    });
  }

  write(bytes: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(1 + bytes.length);
    frame[0] = 0x03;
    frame.set(bytes, 1);
    this.ws.send(frame);
  }

  resize(cols: number, rows: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(5);
    frame[0] = 0x04;
    const view = new DataView(frame.buffer);
    view.setUint16(1, cols, true);
    view.setUint16(3, rows, true);
    this.ws.send(frame);
  }

  dispose(): void {
    this.dataHandlers = [];
    this.exitHandlers = [];
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close(1000, "disposed");
    }
  }
}
