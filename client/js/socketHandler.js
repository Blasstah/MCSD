const socket = io();

/* Here go global socket actions */
socket.on("force_reload", () => {
    window.location.reload();
})