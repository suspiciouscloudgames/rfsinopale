// Test-only Windows display adapter. Real video, GLB, preload and startup code run
// unchanged. Native monitor topology/fullscreen are simulated on this Mac host.
const { app, screen, BrowserWindow } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
app.setPath("userData", process.env.SEA_TEST_DATA);
app.whenReady().then(async () => {
  BrowserWindow.prototype.show = function () {
    this.showInactive();
  };
  const primary = screen.getPrimaryDisplay();
  const count = Number(process.env.SEA_TEST_DISPLAY_COUNT || 2);
  screen.getAllDisplays = () =>
    Array.from({ length: count }, (_, i) => ({
      ...primary,
      id: 101 + i,
      label: `Test ${i + 1}`,
      bounds: { x: 20, y: 20 + i * 400, width: 640, height: 360 },
      size: { width: 640, height: 360 },
    }));
  BrowserWindow.prototype.setFullScreen = function (value) {
    this.__seaFullscreen = value;
    this.emit(value ? "enter-full-screen" : "leave-full-screen");
  };
  BrowserWindow.prototype.isFullScreen = function () {
    return !!this.__seaFullscreen;
  };
  const root =
    process.env.SEA_VERIFY_APP_ROOT || path.resolve(__dirname, "../..");
  await import(pathToFileURL(path.join(root, "desktop/main/main.mjs")).href);
});
