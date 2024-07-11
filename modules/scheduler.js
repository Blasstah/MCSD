const fs = require("fs");
const path = require("path")
const archiver = require("archiver");
const { isNumber } = require("chart.js/helpers");

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

        this.getScheduleTime = (schedule) => {
            let split = schedule.time.split(":");
            if(split.length < 1) return -1;

            let h = Number(split[0]);
            let min = Number(split[1]);

            let time = h + min/60;

            return time;
        }

        this.sort = () => {
            let scheduler = this;
            this.settings.schedules.sort((a, b) => {
                let aTime = scheduler.getScheduleTime(a);
                let bTime = scheduler.getScheduleTime(b);

                return aTime - bTime;
            });
        }

        this.sort();
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

                console.log(`Scheduler disabled`);
            }
        }

        this.saveBackup = (socket, name) => {
            try {
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
                let scheduler = this;
                output.on('close', function () {
                    let size = archive.pointer() / 1024 / 1024;
    
                    let message = `Backup done! (${size.toFixed(0)}MB in size)`;
    
                    if(socket) {
                        socket.emit("backup_done", {filename, size})
                        context.showNotif(socket, message, "success")
                    }
    
                    if(context.currentServer()) {
                        context.currentServer().serverMessage(message);
                        context.currentServer().sendCommand("save-on");
                        context.currentServer().sendCommand("save-all");
                    }

                    scheduler.doingBackup = false;
    
                    console.log(message);
                });
    
                archive.on('error', function(err){
                    output.close();
                    this.context.serverMessage("Could not save backup...")
                    console.log(err);

                    scheduler.doingBackup = false;
                });
    
                archive.pipe(output);
    
                if(fs.existsSync(this.context.relativePath("mc_server/backups/tmp")))
                    fs.rmSync(this.context.relativePath("mc_server/backups/tmp"), {recursive: true, force: true})
                    
                fs.mkdirSync(this.context.relativePath("mc_server/backups/tmp"));
    
                for(let el of this.settings.backup) {
                    if(el == "backups") continue;
                    if(!fs.existsSync(this.context.relativePath("mc_server/"+el))) continue;
                    if(!fs.lstatSync(this.context.relativePath("mc_server/"+el)).isDirectory()) continue;
    
                    if(!fs.existsSync(this.context.relativePath("mc_server/backups/tmp/"+el)))
                        fs.mkdirSync(this.context.relativePath("mc_server/backups/tmp/"+el));
    
                    let data = fs.readdirSync(this.context.relativePath("mc_server/"+el))
                    data.forEach((file) => {
                        if(file == "session.lock") return;
    
                        fs.cpSync(this.context.relativePath("mc_server/"+el+"/"+file), this.context.relativePath("mc_server/backups/tmp/"+el+"/"+file), {recursive: true});
                    })
    
                    archive.directory(`mc_server/backups/tmp/${el}`, el);
                }
    
                archive.finalize().then(() => {
                    fs.rmSync(this.context.relativePath("mc_server/backups/tmp"), {recursive: true, force: true})
                });
            }catch(e) {
                this.context.serverMessage("Could not save backup...")
                console.log(e);
                scheduler.doingBackup = false;
            }
        }

        this.doingBackup = false;
        this.doBackup = (socket, name) => {
            if(!this.settings.backup || this.settings.backup.length <= 0) return;
            if(this.doingBackup) {
                if(socket) {
                    this.context.showNotif(socket, "Backup is already in progress!", "error");
                }
                return;
            }

            this.doingBackup = true;

            if(socket) {
                socket.emit("backup_started")
                this.context.showNotif(socket, "Starting server backup...")
            }

            let scheduler = this;
            if(this.context.currentServer()) {
                this.context.currentServer().serverMessage("Starting server backup...");
                this.context.currentServer().sendCommand("save-all");
                this.context.currentServer().sendCommand("save-off");
            }

            setTimeout(() => {
                scheduler.saveBackup(socket, name);
            }, this.context.currentServer() ? 10000 : 10);
        }

        if(this.settings.running) this.startScheduler();

        context.addMenuTab("stopwatch", "Scheduler", "/scheduler", 3)

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

        this.registerSecureSocket = (socket) => {

            let context = this.context;
            socket.on("do_backup", () => {
                this.doBackup(socket);
            })

            socket.on("restart_server", () => {
                if(this.context.currentServer())
                    this.context.currentServer().restart(socket);
                else
                    this.context.showNotif(socket, "Server needs to be running in order to restart it!")
            })

            socket.on("scheduler_settings", (data) => {
                try {
                    let enabled = data.enabled;
                    let backupsStored = data.backupsStored;
                    let dirs = data.dirs;
    
                    if(!enabled && this.isRunning()) {
                        this.stopScheduler();
                    }else if(enabled && !this.isRunning()) {
                        this.startScheduler();
                    }
    
                    this.settings.backups_stored = Number(backupsStored);
                    this.settings.running = enabled;
    
                    if(typeof(dirs) == "object")  {
                        dirs.forEach(el => {
                            if(typeof(el) != "string") throw "Bad dir data!";
                        });
    
                        this.settings.backup = dirs;
                    }
    
                    context.showNotif(socket, "Scheduler settings saved!", "success");

                    context.saveConfig("scheduler", this.settings);
                }catch {
                    context.showNotif(socket, "Could not save scheduler settings...", "error");
                }
            })

            socket.on("scheduler_delete", (index) => {
                if(index >= this.settings.schedules.length || index < 0) {
                    context.showNotif(socket, "Invalid shedule ID!", "error")
                    return;
                }

                this.settings.schedules.splice(index, 1)
                this.sort()

                context.saveConfig("scheduler", this.settings);

                socket.emit("force_reload", {message: "Successfully deleted schedule!", type: "success"})
            })

            let types = ["message", "command", "backup", "restart"]
            socket.on("scheduler_new_action", (data) => {
                let type = data.type;
                let meta = data.meta;
                let rawTime = data.time;
                let rawDays = data.days;

                let days = [];

                let timeSplit = rawTime.split(':')
                let hour = Number(timeSplit[0])
                let minute = Number(timeSplit[1])

                if(isNaN(hour) || isNaN(minute)) {
                    context.showNotif(socket, "Bad time definition!", "error")
                    return;
                }

                let time = `${hour > 9 ? hour : `0${hour}`}:${minute > 9 ? minute : `0${minute}`}`;

                rawDays.forEach(el => {
                    if(isNumber(el) && el > -1 && el < 7)
                        days.push(el);
                });

                days.sort((a, b) => a > b)

                if(days.length <= 0) {
                    context.showNotif(socket, "No week days defined!", "error")
                    return;
                }

                if(types[type] == undefined || types[type] == null) {
                    context.showNotif(socket, "Type error! Couldn't find a type of specified ID!", "error")
                    return;
                }

                let schedule = {
                    type: types[type],
                    time,
                    days,
                }

                for(let x in meta)
                    schedule[x] = meta[x];

                this.settings.schedules.push(schedule);
                this.sort()

                context.saveConfig("scheduler", this.settings);

                socket.emit("force_reload", {message: "Successfully added new schedule!", type: "success"})
            })
        }
    }
}

module.exports = function(context) {
    return new SchedulerModule(context);
}