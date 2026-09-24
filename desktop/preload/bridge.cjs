const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "installation",
  Object.freeze({
    bootstrap: () => ipcRenderer.invoke("sea:bootstrap"),
    clock: () => ipcRenderer.invoke("sea:clock"),
    command: (name, data) => ipcRenderer.invoke("sea:command", name, data),
    report: (data) => ipcRenderer.send("sea:report", data),
    trigger: (event) => ipcRenderer.invoke("sea:trigger", event),
    onState: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("sea:state", listener);
      return () => ipcRenderer.removeListener("sea:state", listener);
    },
    onRequest: (callback) => {
      ipcRenderer.on("sea:request", async (_event, { id, name, data }) => {
        try {
          const result = await callback(name, data);
          ipcRenderer.send("sea:reply", { id, result });
        } catch (error) {
          ipcRenderer.send("sea:reply", {
            id,
            error: String(error.message || error),
          });
        }
      });
    },
  }),
);
