const notifier = require('node-notifier');
const path = require('path');
const fs = require('fs');
const Axios = require('axios');
const shell = require('node-powershell');

//studio
const driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=101&pfid=815&osID=57&languageCode=1033&beta=0&isWHQL=0&dltype=-1&dch=1&upCRD=1&qnf=0&sort1=0&numberOfResults=10";
// game
//const driverUrl = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php?func=DriverManualLookup&psid=101&pfid=815&osID=57&languageCode=1033&beta=null&isWHQL=0&dltype=-1&dch=1&upCRD=null&qnf=0&sort1=0&numberOfResults=10";

async function getInstalledVersion() {  

    let ps = new shell({
        executionPolicy: 'Bypass',
        noProfile: true
    });
      
    ps.addCommand('(Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.devicename -like "*nvidia*" -and $_.devicename -notlike "*audio*" -and $_.devicename -notlike "*USB*" -and $_.devicename -notlike "*SHIELD*" }).DriverVersion.SubString(7).Remove(1, 1).Insert(3, ".")');  
    return new Promise((resolve, reject) => {
        ps.invoke().then(output => {
            resolve(output);
          }).catch(err => {
            reject(err);
            ps.dispose();
          });
    });
  }


async function getFile(url, p) {  
    const writer = fs.createWriteStream(p);
    const response = await Axios({
        url,
        method: 'GET',
        responseType: 'stream',
        onDownloadProgress: function (progressEvent) {
            console.log(progressEvent);
        },
    });
  
    response.data.pipe(writer);
  
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    });
  }


async function getDriverVersions() {
    let iv = await getInstalledVersion();
    iv = Number(iv);

    Axios.get(driverUrl)
        .then((response) => {
            let IDS = response.data.IDS;
            IDS = IDS.sort((a, b) => Number(a.downloadInfo.Version) < Number(b.downloadInfo.Version));
            const driver = IDS[0].downloadInfo;
            const version = Number(driver.Version);
            const url = driver.DownloadURL;
            console.log("Installed: ", iv);
            console.log("Available: ", version);
            if (version > iv) {
                notify(iv, version, url);
            } else {
                console.log("up to date, exiting");
                process.exit(0);
            }
        }, (error) => {
            console.log(error);
            process.exit(1);
        });      
}

function notify(iv, version, url) {
    notifier.notify({
        title: 'Nvidia - New 1080 driver available',
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
        title: 'Nvidia - New 1080 driver',
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
            let ps = new shell({
                executionPolicy: 'Bypass',
                noProfile: true
            });
              
            ps.addCommand(p); 
            return new Promise((resolve, reject) => {
                ps.invoke().then(output => {
                    resolve(output);
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
