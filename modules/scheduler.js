const fs = require("fs");
const path = require("path")
const archiver = require("archiver");

class SchedulerModule {
    constructor(context) {
        this.context = context;

        const def = {
            running: true,
            backup: ["world", "world_the_nether", "world_the_end", "logs"],
            backups_stored: 6,
            interval: 15000,
            schedules: [
                {
                    type: "backup",
                    time: "08:00",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "backup",
                    time: "15:00",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "backup",
                    time: "21:00",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "backup",
                    time: "02:50",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "message",
                    message: `Server will restart in 5 minutes! Keep yourself safe!`,
                    time: "02:55",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "message",
                    message: `Server will restart in ~1 minute!`,
                    time: "02:59",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                {
                    type: "restart",
                    time: "03:00",
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
            ]
        }

        this.settings = context.readConfig("scheduler", def);
        context.saveConfig("scheduler", this.settings);

        this.isRunning = () => this.intervalId != null;

        let lastHour = null;
        this.scheduler = () => {
            let date = new Date();

            let hour = date.getHours();
            let minute = date.getMinutes();
            let day = date.getDay();

            let time = `${hour > 9 ? hour : `0${hour}`}:${minute > 9 ? minute : `0${minute}`}`;

            if(lastHour == time) return;

            this.settings.schedules.forEach(el => {
                if(el.time == time && el.days.indexOf(day) > -1) {
                    console.log(`[${time}] Running scheduled task "${el.type}".`)

                    if(el.type == "backup") this.doBackup();
                    else if(el.type == "restart") {
                        if(this.context.currentServer()) this.context.currentServer().restart();
                        else this.context.toggleServer();
                    }
                    else if(el.type == "command") this.context.currentServer().sendCommand(el.command);
                    else if(el.type == "message") this.context.currentServer().serverMessage(el.message);
                }
            })

            lastHour = time;
        }

        this.startScheduler = () => {
            this.intervalId = setInterval(this.scheduler, this.settings.interval)
            
            let date = new Date();
            let hour = date.getHours();
            let minute = date.getMinutes();
            let day = date.getDay();
            let time = `${hour > 9 ? hour : `0${hour}`}:${minute > 9 ? minute : `0${minute}`}`;
            console.log(`Scheduler started at ${time}, day ${day}`);
        }

        this.stopScheduler = () => {
            if(this.intervalId != null) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        }

        this.doBackup = (socket, name) => {
            if(!this.settings.backup || this.settings.backup.length <= 0) return;

            if(socket) socket.emit("backup_started")

            if(this.context.currentServer()) 
                this.context.currentServer().serverMessage("Starting server backup...");

            console.log("Starting server backup...");

            if(!fs.existsSync(this.context.relativePath("mc_server/backups"))) {
                fs.mkdirSync(this.context.relativePath("mc_server/backups"));
            }

            let filename = new Date().toUTCString();
            filename = filename.replaceAll(":", "-")
            filename = filename.replaceAll(",", "")
            filename = filename.replaceAll(" ", "_")

            if(typeof(name) == "string")
                filename = name;

            let output = fs.createWriteStream(this.context.relativePath(`mc_server/backups/${filename}.zip`))
            var archive = archiver('zip', {zlib: {level: 9}});

            let context = this.context;
            output.on('close', function () {
                let size = archive.pointer() / 1024 / 1024;

                let message = `Backup done! (${size.toFixed(0)}MB in size)`;

                if(context.currentServer()) 
                    context.currentServer().serverMessage(message);

                if(socket) socket.emit("backup_done", {filename, size})

                console.log(message);
            });

            archive.on('error', function(err){
                throw err;
            });

            archive.pipe(output);

            for(let el of this.settings.backup) {
                if(el == "backups") continue;
                if(!fs.existsSync(this.context.relativePath("mc_server/"+el))) continue;
                if(!fs.lstatSync(this.context.relativePath("mc_server/"+el)).isDirectory()) continue;

                archive.directory(`mc_server/${el}`, el);
            }

            archive.finalize();
        }

        if(this.settings.running) this.startScheduler();

        context.addEntryPoint("/scheduler", (req, res, data) => {
            const fileScan = fs.readdirSync(context.relativePath("mc_server"));
            let dirs = [];

            fileScan.forEach(el => {
                if(fs.lstatSync(context.relativePath("mc_server/"+el)).isDirectory() && !el.startsWith(".") && el != "backups") dirs.push(el);
            });

            data.scheduler = this.settings;
            data.scannedDirs = dirs;
            data.isRunning = this.isRunning();

            res.render("scheduler", data);
        })
    }
}

module.exports = function(context) {
    return new SchedulerModule(context);
}