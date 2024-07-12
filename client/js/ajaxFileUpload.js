function AJAX_sendFile(file, name, url, callbacks) {
    if(!callbacks) callbacks = {};

    var formData = new FormData();
    formData.append(name, file);

    var req = new XMLHttpRequest();

    if(typeof(callbacks.start) == "function")
        req.upload.addEventListener("loadstart", callbacks.start)

    if(typeof(callbacks.progress) == "function")
        req.upload.addEventListener("progress", callbacks.progress)

    if(typeof(callbacks.complete) == "function")
        req.upload.addEventListener("load", callbacks.complete)

    if(typeof(callbacks.error) == "function")
        req.upload.addEventListener("error", callbacks.error)

    if(typeof(callbacks.abort) == "function")
        req.upload.addEventListener("abort", callbacks.abort)

    req.open("POST", url)

    req.send(formData)

    return req;
}