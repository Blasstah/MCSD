const socket = io();
/* Here go global socket actions */
socket.on("force_reload", (message) => {
    if(message) {
        window.sessionStorage.setItem("reload_info", JSON.stringify(message))
    }

    window.location.reload();
})