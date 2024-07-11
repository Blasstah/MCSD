const fs = require("fs")
const path = require("path");
const adm = require('adm-zip');
const toml = require("toml");
const yaml = require("yaml");
const { destr } = require("destr");

class AddonsModule {
    constructor(context) {
        this.context = context;

        this.pluginsDir = context.relativePath("mc_server/plugins");
        this.modsDir = context.relativePath("mc_server/mods");

        context.addMenuTab("plugin", "Plugins / Mods", "/addons", 1)

        this.cache = {};

        this.getAddonInfo = (filePath) => {
            let obj = {
                file: path.basename(filePath),
                id: "",
                name: "",
                version: "",
                mc_version: "",
                desc: "",
                authors: [""],
                type: "mod",
                platform: "fabric",
                dependencies: []
            }

            let iconName = null;

            if(this.cache[filePath]) {
                return this.cache[filePath];
            }

            // Search for mod info
            try {
                const zip = new adm(filePath);

                // Przeszukaj zawartość archiwum
                const zipEntries = zip.getEntries();
                for(let entry of zipEntries) {
                    // Handle Fabric
                    if (entry.entryName === 'fabric.mod.json') {
                        // Odczytaj zawartość pliku
                        let content = entry.getData().toString('utf8');
                        content = content.replaceAll("\n", "")

                        obj.type = "mod";
                        obj.platform = "fabric";

                        try {
                            const data = destr(content)

                            if(!data.id)
                                console.log(data)
        
                            obj.version = data.version;
                            obj.mc_version = "",
        
                            obj.id = data.id;
                            obj.name = data.name;
                            obj.desc = data.description;
                            obj.authors = data.authors;

                            if(data.depends)
                                obj.dependencies = Object.keys(data.depends);

                            iconName = data.icon;
                        }catch(e) {
                           console.log(e)
                        }
                        break;
                    }
    
                    //Handle Forge Older
                    if (entry.entryName === 'mcmod.info') {
                        // Odczytaj zawartość pliku
                        const content = entry.getData().toString('utf8');

                        obj.type = "mod";
                        obj.platform = "forge";

                        try {
                            const data = destr(content);

                            if(data.modList) {
                                obj.mc_version = "",
                                obj.version = data.modList[0].version;
            
                                obj.id = data.modList[0].modid;
                                obj.name = data.modList[0].name;
                                obj.desc = data.modList[0].description;
                                obj.authors = data.modList[0].authorList;
    
                                iconName = data.modList[0].logoFile;
                                break;
                            }
        
                            obj.mc_version = "",
                            obj.version = data[0].version;
        
                            obj.id = data[0].modid;
                            obj.name = data[0].name;
                            obj.desc = data[0].description;
                            obj.authors = data[0].authorList;

                            iconName = data[0].logoFile;
                        }catch {
                           // Handle bad forge toml
                        }
                        break;
                    }

                    // Handle Forge Newer
                    if (entry.entryName === 'META-INF/mods.toml') {
                        // Odczytaj zawartość pliku
                        const content = entry.getData().toString('utf8');

                        obj.type = "mod";
                        obj.platform = "forge";

                        try {
                            const data = toml.parse(content);
        
                            obj.mc_version = "",
                            obj.version = data.mods[0].version;
        
                            obj.id = data.mods[0].modId;
                            obj.name = data.mods[0].displayName;
                            obj.desc = data.mods[0].description;
                            obj.authors = [data.mods[0].authors];

                            iconName = data.mods[0].logoFile;
                        }catch {
                           // Handle bad forge toml
                        }
                        break;
                    }
    
                    //Handle Plugins
                    if (entry.entryName === 'plugin.yml') {
                        // Odczytaj zawartość pliku
                        const content = entry.getData().toString('utf8');
    
                        obj.type = "plugin";
                        obj.platform = "paper/spigot";

                        try {
                            const data = yaml.parse(content);

                            obj.version = data.version;
                            obj.mc_version = "",
        
                            obj.id = data.name.toLowerCase();
                            obj.name = data.name;
                            obj.desc = data.description;
                            obj.authors = [data.author];
                        }catch {
                            // Handle bad plugin yaml
                        }
                        break;
                    }
                }

                // Search for Icon, if found reference
                if(iconName) {
                    for(let entry of zipEntries) {
                        if (entry.entryName === iconName) {
                            const content = entry.getData();

                            try {
                                obj.icon = Buffer.from(content).toString("base64");
                            }catch {
                                // Handle bad icon conversion
                            }
                            break;
                        }
                    }
                }
    
                this.cache[filePath] = obj;
                return obj;
            }catch(e) {
                return null;
            }
        }

        this.rebuildCache = () => {
            let hasPlugins = fs.existsSync(this.pluginsDir)
            let hasMods = fs.existsSync(this.modsDir)

            let objs = null
            if(hasPlugins) {
                objs = fs.readdirSync(this.pluginsDir);

                objs.forEach(el => {
                    if(!el.endsWith(".jar")) return;

                    this.getAddonInfo(path.join(this.pluginsDir, el));
                });
            }

            if(hasMods) {
                objs = fs.readdirSync(this.modsDir);

                objs.forEach(el => {
                    if(!el.endsWith(".jar")) return;
                    
                    this.getAddonInfo(path.join(this.modsDir, el));
                });
            }
        }

        console.log("Rebuilding Addon (Plugins and/or Mods) cache. This may take a while...")
        this.rebuildCache();

        context.addEntryPoint("/addons", (req, res, data) => {
            let hasPlugins = fs.existsSync(this.pluginsDir)
            let hasMods = fs.existsSync(this.modsDir)

            let addons = { }

            var objs = null;
            if(hasPlugins) {
                objs = fs.readdirSync(this.pluginsDir);

                let plugins = []

                objs.forEach(el => {
                    if(!el.endsWith(".jar")) return;

                    let data = this.getAddonInfo(path.join(this.pluginsDir, el));
                    plugins.push(data);
                });
                
                addons.plugins = plugins;
            }

            if(hasMods) {
                objs = fs.readdirSync(this.modsDir);

                let mods = []

                objs.forEach(el => {
                    if(!el.endsWith(".jar")) return;
                    
                    let data = this.getAddonInfo(path.join(this.modsDir, el));
                    mods.push(data);
                });

                addons.mods = mods;
            }

            data.addons = addons;
            res.render("addons", data);
        })
    }
}

module.exports = function(context) {
    return new AddonsModule(context);
}