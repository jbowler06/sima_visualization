
// classes in this file
var Instruction,
    AjaxManager;

Instruction = function() {

    // field declaration
    var request,
        onDone,
        onFail,
        onAlways;

    // method declaration
    var init,
        getRequest,
        getOnDone,
        getOnFail,
        getOnAlways;


    init = function (req, done, fail, always) {
        request = req;
        onDone = done;
        onFail = fail;
        onAlways = always;
    };

    getRequest = function() {
        return request;
    };

    getOnDone = function() {
        return onDone;
    };

    getOnFail = function () {
        return onFail;
    };

    getOnAlways = function () {
        return onAlways;
    };

    return {
        init: init,
        getRequest: getRequest,
        getOnDone: getOnDone,
        getOnFail: getOnFail,
        getOnAlways: getOnAlways
    };

};

AjaxManager = (function() {

    // field declaration
    var instQueue, isProcessing;

    // method declaration
    var init,
        sendRequest,
        addRequest,
        processNextRequest;

    // initializes an AjaxManager
    init = function() {
        // field initialization
        instQueue = [];
        isProcessing = false;
    };

    // adds a request. request can be processed immediately
    // or via the queue.
    addRequest = function(instruct, enqueue) {
        if (enqueue) {
            instQueue.push(instruct);

            // if the queue is currently not processing, resume processing
            if (!isProcessing) processNextRequest();

        }
        else {
            sendRequest(instruct);
        }
    };

    // sends a request via ajax. if the request
    // is from the queue, then begin processing the
    // next request in the queue
    sendRequest = function(instruct, fromQueue) {

        // sending ajax request stored in instruct
        $.ajax(instruct.getRequest()
        ).done(
            function (response) {
                instruct.getOnDone()(response);
            }
        ).fail(
            function(response) {
                instruct.getOnFail()(response);
            }
        ).always(
            function (response) {
                instruct.getOnAlways()(response);
                // if this request was from the queue
                // process the next request in the queue
                if (fromQueue) processNextRequest();
            }
        );

    };

    // processes the next request in the queue
    processNextRequest = function() {

        // only process if queue is non-empty
        if (instQueue.length > 0) {
            isProcessing = true;
            sendRequest(instQueue.shift(), true);
        }
        else {
            isProcessing = false;
        }

    };

    return {
        init: init,
        addRequest: addRequest
    };

});