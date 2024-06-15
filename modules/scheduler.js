class SchedulerModule {
    constructor(context) {
        this.context = context;

        context.addEntryPoint("/scheduler", (req, res, data) => {
            res.render("scheduler", data);
        })
    }
}

module.exports = function(context) {
    return new SchedulerModule(context);
}