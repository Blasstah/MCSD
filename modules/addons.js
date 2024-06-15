const fs = require("fs")

class AddonsModule {
    constructor(context) {
        this.context = context;

        this.pluginsDir = context.relativePath("mc_server/plugins");
        this.modsDir = context.relativePath("mc_server/mods");

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
                    plugins.push(el);
                });
                
                addons.plugins = plugins;
            }

            if(hasMods) {
                objs = fs.readdirSync(this.modsDir);
                
                let mods = [];

                objs.forEach(el => {
                    if(!el.endsWith(".jar")) return;
                    mods.push(el);
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