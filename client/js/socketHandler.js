const socket = io();

socket.on("force_reload", () => {
    window.location.reload();
})