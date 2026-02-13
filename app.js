const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { PowerShell } = require("node-powershell");

// ================= CONFIG =================

//studio
let driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=131&pfid=1076&osID=135&languageCode=1033&beta=0&isWHQL=0&dltype=-1&dch=1&upCRD=1&qnf=0&sort1=1&numberOfResults=10";
// game
//driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=131&pfid=1076&osID=135&languageCode=1033&beta=0&isWHQL=0&dltype=-1&dch=1&upCRD=0&qnf=0&sort1=1&numberOfResults=10";

const DRIVER_DIR = path.resolve(__dirname, "drivers");

// ================= MAIN =================

main();

// ================= FLOW =================

async function main() {
  try {
    ensureDir();

    const installed = await getInstalledVersion();
    const latest = await getLatestDriver();

    console.log("Installed:", installed);
    console.log("Available:", latest.version);

    if (latest.version <= installed) {
      console.log("Up to date");
      process.exit(0);
    }

    const filePath = await download(latest.url);

    launchInstaller(filePath);

  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// ================= SETUP =================

function ensureDir() {
  if (!fs.existsSync(DRIVER_DIR)) {
    fs.mkdirSync(DRIVER_DIR, { recursive: true });
  }
}

// ================= VERSION =================

async function getInstalledVersion() {

  const ps = new PowerShell({
    executionPolicy: "Bypass",
    noProfile: true,
  });

  const cmd = PowerShell.command`
(Get-WmiObject Win32_PnPSignedDriver |
Where-Object {
$_.devicename -like "*nvidia*" -and
$_.devicename -notlike "*audio*" -and
$_.devicename -notlike "*USB*" -and
$_.devicename -notlike "*SHIELD*"
}).DriverVersion.SubString(6).Remove(1,1).Insert(3,".")
`;

  const out = await ps.invoke(cmd);

  ps.dispose();

  return Number(out.raw);
}

// ================= LOOKUP =================

async function getLatestDriver() {

  const res = await fetch(driverUrl);

  if (!res.ok) {
    throw new Error("Driver lookup failed");
  }

  const data = await res.json();

  const list = data.IDS;

  list.sort(
    (a, b) =>
      Number(b.downloadInfo.Version) -
      Number(a.downloadInfo.Version)
  );

  const d = list[0].downloadInfo;

  return {
    version: Number(d.Version),
    url: d.DownloadURL,
  };
}

// ================= DOWNLOAD =================
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";

  const units = ["KB", "MB", "GB", "TB"];

  let i = -1;

  do {
    bytes /= 1024;
    i++;
  } while (bytes >= 1024 && i < units.length - 1);

  return bytes.toFixed(1) + " " + units[i];
}

async function download(url) {

  const name = path.basename(url);

  const filePath = path.join(DRIVER_DIR, name);

  console.log("Downloading:", name);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Download failed");
  }

  const total = Number(res.headers.get("content-length")) || 0;

  const file = fs.createWriteStream(filePath);

  const reader = res.body.getReader();

  let downloaded = 0;

  while (true) {

    const { done, value } = await reader.read();

    if (done) break;

    downloaded += value.length;

    file.write(Buffer.from(value));

    if (total) {
      const pct = ((downloaded / total) * 100).toFixed(1);

      process.stdout.write(
        `\r${formatBytes(downloaded)} / ${formatBytes(total)} (${pct}%)`
      );
    } else {
      process.stdout.write(
        `\r${formatBytes(downloaded)}`
      );
    }
  }

  file.end();

  await new Promise(r => file.on("finish", r));

  process.stdout.write("\n");

  console.log("Saved:", filePath);

  return filePath;
}


// ================= INSTALL =================

function launchInstaller(p) {
  const fullPath = path.resolve(p);
  console.log("Launching installer:", fullPath);

  // Wrap path in double quotes
  const cmd = `start "" "${fullPath}"`;

  exec(cmd, { windowsHide: false }, (err) => {
    if (err) {
      console.error("Failed to launch installer:", err);
      process.exit(1);
    }
    process.exit(0);
  });
}

