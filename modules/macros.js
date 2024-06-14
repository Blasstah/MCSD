const fs = require("fs");
const path = require("path");
const { escape, unescape } = require("querystring");

class MacrosModule {
    constructor(context) {
        this.isModule = true;
        this.context = context;

        this.macros = [];
        if(fs.existsSync(context.relativePath("macros.json"))) 
            this.macros = JSON.parse(fs.readFileSync(context.relativePath("macros.json")))

        this.doMacro = (macro) => {
            if(macro.apply == null) return;

            let index = 0;
            
            this.context.currentServer().serverMessage(`Applying \\\"${macro.name}\\\" macro...`)
            for(let cmd of macro.apply) {
                if(index == 0)
                    this.context.currentServer().sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.context.currentServer().sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
        }

        this.revertMacro = (macro) => {
            if(macro.revert == null) return;

            this.context.currentServer().serverMessage(`Reverting \\\"${macro.name}\\\" macro...`)
            let index = 0;
            for(let cmd of macro.revert) {
                if(index == 0)
                    this.context.currentServer().sendCommand(cmd);
                else {
                    setTimeout(() => {
                        this.context.currentServer().sendCommand(cmd);
                    }, index*50);
                }

                index++;
            }
        }

        this.save = () => {
            fs.writeFileSync(context.relativePath("macros.json"), JSON.stringify(this.macros, null, 4))
        }
        
        this.registerSecureSocket = (socket) => {
            socket.on("macro_apply", (index) => {
                if(typeof index != "number") return;
                if(!this.context.currentServer()) {
                    return;
                }
        
                if(this.macros.length <= index) return;
        
                this.doMacro(this.macros[index]);
            })
        
            socket.on("macro_revert", (index) => {
                if(typeof index != "number") return;
                if(!this.context.currentServer()) {
                    return;
                }
        
                if(this.macros.length <= index) return;
        
                this.revertMacro(this.macros[index]);
            })
        
            socket.on("macro_remove", (index) => {
                if(typeof index != "number") return;
                if(this.macros.length <= index) return;
        
                this.macros.splice(index, 1)
                this.save();
                
                socket.emit("force_reload")
            })
        
            socket.on("macro_code", (index) => {
                if(index >= this.macros.length) {
                    return;
                }
        
                let json = JSON.stringify(this.macros[index]);
                let base64 = btoa(escape(json));
        
                socket.emit("macro_code", {code: base64, index})
            })
        
            socket.on("add_macro_code", (code) => {
                if(typeof code != "string") return;
        
                try {
                    let json = atob(code)
                    let macro = JSON.parse(unescape(json));
                    if(macro == null) return;
        
                    if(macro.apply == null) return;
                    if(macro.revert == null) return
                    if(macro.name == null) return;
                    if(macro.desc == null) return;
                    if(macro.author == null) return;
        
                    let obfMacro = {
                        name: macro.name,
                        author: macro.author,
                        desc: macro.desc,
                        apply: macro.apply,
                        revert: macro.revert,
                    }
        
                    this.macros.push(obfMacro);
                    this.save();
        
                    socket.emit("force_reload")
                }catch {
                    // Error
                }
            })
        
            socket.on("create_macro", (data) => {
                if(data.apply == null) return;
                if(data.revert == null) return
                if(data.name == null) return;
                if(data.desc == null) return;
                if(data.author == null) return;
        
                let obfMacro = {
                    name: data.name,
                    author: data.author,
                    desc: data.desc,
                    apply: data.apply,
                    revert: data.revert,
                }
        
                this.macros.push(obfMacro);
                this.save();
        
                socket.emit("force_reload")
            })
        }

        context.addEntryPoint("/macros", (req, res, data) => {
            data.macros = this.macros;
            res.render("macros", data)
        })
    }
}

module.exports = function(context) {
    return new MacrosModule(context);
}