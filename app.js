const notifier = require('node-notifier');
const path = require('path');
const fs = require('fs');
const { PowerShell } = require('node-powershell');

// 5060Ti on win 11
//studio
let driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=131&pfid=1076&osID=135&languageCode=1033&beta=0&isWHQL=0&dltype=-1&dch=1&upCRD=1&qnf=0&sort1=1&numberOfResults=10";
// game
//driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=131&pfid=1076&osID=135&languageCode=1033&beta=0&isWHQL=0&dltype=-1&dch=1&upCRD=0&qnf=0&sort1=1&numberOfResults=10";

async function getInstalledVersion() {  

    let ps = new PowerShell({
        executionPolicy: 'Bypass',
        noProfile: true
    });
      
    var command = PowerShell.command`(Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.devicename -like "*nvidia*" -and $_.devicename -notlike "*audio*" -and $_.devicename -notlike "*USB*" -and $_.devicename -notlike "*SHIELD*" }).DriverVersion.SubString(6).Remove(1, 1).Insert(3, ".")`  
    return new Promise((resolve, reject) => {
        ps.invoke(command).then(output => {
            resolve(output);
          }).catch(err => {
            reject(err);
            ps.dispose();
          });
    });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let u = -1;
  do {
    bytes /= 1024;
    ++u;
  } while (bytes >= 1024 && u < units.length - 1);
  return bytes.toFixed(1) + " " + units[u];
}

async function getFile(url, p) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const fileStream = fs.createWriteStream(p);
  const reader = res.body.getReader();

  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;

    if (total) {
      const pct = ((loaded / total) * 100).toFixed(1);
      process.stdout.write(
        `\rDownloaded ${formatBytes(loaded)} / ${formatBytes(total)} (${pct}%)`
      );
    } else {
      process.stdout.write(`\rDownloaded ${formatBytes(loaded)}`);
    }

    fileStream.write(Buffer.from(value));
  }
  fileStream.end();

  await new Promise((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });

  process.stdout.write("\n");
}

async function getDriverVersions() {
    let iv = await getInstalledVersion();
    iv = Number(iv.raw);

    try {
        const res = await fetch(driverUrl);
        if (!res.ok) throw new Error(`Driver lookup failed: ${res.statusText}`);
        const data = await res.json();
        let IDS = data.IDS;
        IDS = IDS.sort((a, b) => Number(b.downloadInfo.Version) - Number(a.downloadInfo.Version));
        const driver = IDS[0].downloadInfo;
        const version = Number(driver.Version);
        const url = driver.DownloadURL;
        console.log("Installed:", iv);
        console.log("Available:", version);
        if (version > iv) {
            notify(iv, version, url);
        } else {
            console.log("up to date, exiting");
            process.exit(0);
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

function notify(iv, version, url) {
    notifier.notify({
        title: 'Nvidia - New 5060Ti driver available',
        message: 'There is a new driver for download! It is version ' + version + ' and you have ' + iv + '! Click to download it now!',
        icon: path.join(__dirname, 'card.png'), // Absolute path (doesn't work on balloons)
        sound: true, // Only Notification Center or Windows Toasters
        wait: true, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
        appID: "All this cos Geforce Experience sucks",
        timeout: 300
    },
    async function (err, response, metadata) {
        if (response === "timeout") {
            console.log("Exiting..."); 
            process.exit(0);           
        }
        console.log("Downloading..."); 
        try {
            const filename = path.basename(url);
            const p = path.resolve(__dirname, 'drivers', filename);            
            await getFile(url, p);
            await downloadCompleteNotification(p);
        } catch(e) {
            console.error(e);
            process.exit(1);
        }
    });
}

async function downloadCompleteNotification(p) {
    notifier.notify({
        title: 'Nvidia - New 5060Ti driver',
        message: 'Download complete! Click to install it!',
        icon: path.join(__dirname, 'card.png'), // Absolute path (doesn't work on balloons)
        sound: true, // Only Notification Center or Windows Toasters
        wait: true, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
        appID: "All this cos Geforce Experience sucks",
        timeout: 300
    }, async function (err, response) {
        if (response === "timeout") {
            console.log("Exiting. Driver is in driver folder.")
            process.exit(0);
        }
        try {
            console.log(`Driver downloaded to ${p}`);
            let ps = new PowerShell({
                executionPolicy: 'Bypass',
                noProfile: true
            });
            
            command = PowerShell.command`${p}`;
            return new Promise((resolve, reject) => {
                ps.invoke(p).then(output => {
                    resolve(output.raw);
                    process.exit(0);
                }).catch(err => {
                    reject(err);
                    ps.dispose();
                    process.exit(0);
                });
            });
        } catch(e) {
            console.error(e);
            process.exit(1);
        }
    });
}

getDriverVersions();
