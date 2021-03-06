// see https://github.com/plotly/plotly.py/commit/a226e07393c158e01c34c050aaf492da9d77679a
// see https://github.com/sfotiadis/plotly.py/commit/c55f2a992684af1021ffe5df22f9617d964bf451

window.genUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

//var IPYTHON_VERSION = '3';

// The following 8 lines of code are taken from https://github.com/quantopian/qgrid/.
if (IPython.version[0] === '4' && parseInt(IPython.version[2]) >= 2) {
    var path = 'jupyter-js-widgets';
} else {
    var path = 'widgets/js/widget';
    if (IPython.version[0] !== '3') {
        path = 'nbextensions/widgets/' + path;
    }
}

//define('GraphViewModule', [path], function (widget) {
define('graphWidget', ["@jupyter-widgets/base"], function (widget) {
    var IPYTHON_VERSION = '3';

//require(["widgets/js/widget", "widgets/js/manager"], function (widget, manager) {
//    if (!('DOMWidgetView' in widget)) {

        // we're in IPython2, things moved a bit from 2 --> 3.
        // construct the expected IPython3 widget API
//        IPYTHON_VERSION = '2';
//        manager = {WidgetManager: widget};
//        widget = {DOMWidgetView: IPython.DOMWidgetView};
//    }

    var GraphView = widget.DOMWidgetView.extend({
        render: function(){
            var that = this;

            var graphId = window.genUID();
            var loadingId = 'loading-'+graphId;


            var _graph_url = that.model.get('_graph_url');

            // variable plotlyDomain in the case of enterprise
            var url_parts = _graph_url.split('/');
            var plotlyDomain = url_parts[0] + '//' + url_parts[2];

            if(!('plotlyDomains' in window)){
                window.plotlyDomains = {};
            }
            window.plotlyDomains[graphId] = plotlyDomain;

            // Place IFrame in output cell div `$el`
            that.$el.css('width', '100%');
            that.$graph = $(['<iframe id="'+graphId+'"',
                             'src="'+_graph_url+'.embed"',
                             'seamless',
                             'style="border: none;"',
                             'width="100%"',
                             'height="600">',
                             '</iframe>'].join(' '));
            that.$graph.appendTo(that.$el);

            that.$loading = $('<div id="'+loadingId+'">Initializing...</div>')
                            .appendTo(that.$el);

            // for some reason the 'width' is being changed in IPython 3.0.0
            // for the containing `div` element. There's a flicker here, but
            // I was unable to fix it otherwise.
            setTimeout(function ()  {
                if (IPYTHON_VERSION === '3') {
                    $('#' + graphId)[0].parentElement.style.width = '100%';
                }
            }, 500);

            // initialize communication with the iframe
            if(!('pingers' in window)){
                window.pingers = {};
            }

            window.pingers[graphId] = setInterval(function() {
                that.graphContentWindow = $('#'+graphId)[0].contentWindow;
                that.graphContentWindow.postMessage({task: 'ping'}, plotlyDomain);
            }, 200);

            // Assign a message listener to the 'message' events
            // from iframe's postMessage protocol.
            // Filter the messages by iframe src so that the right message
            // gets passed to the right widget
            if(!('messageListeners' in window)){
                 window.messageListeners = {};
            }

            window.messageListeners[graphId] = function(e) {
                if(_graph_url.indexOf(e.origin)>-1) {
                    var frame = document.getElementById(graphId);

                    if(frame === null){
                        // frame doesn't exist in the dom anymore, clean up it's old event listener
                        window.removeEventListener('message', window.messageListeners[graphId]);
                        clearInterval(window.pingers[graphId]);
                    } else if(frame.contentWindow === e.source) {
                        // TODO: Stop event propagation, so each frame doesn't listen and filter
                        var frameContentWindow = $('#'+graphId)[0].contentWindow;
                        var message = e.data;

                        if('pong' in message && message.pong) {
                            $('#loading-'+graphId).hide();
                            clearInterval(window.pingers[graphId]);
                            that.send({event: 'pong', graphId: graphId});
                        } else if (message.type==='hover' ||
                                   message.type==='zoom'  ||
                                   message.type==='click' ||
                                   message.type==='unhover') {

                            // click and hover events contain all of the data in the traces,
                            // which can be a very large object and may take a ton of time
                            // to pass to the python backend. Strip out the data, and require
                            // the user to call get_figure if they need trace information
                            if(message.type !== 'zoom') {
                                for(var i in message.points) {
                                    delete message.points[i].data;
                                    delete message.points[i].fullData;
                                }
                            }
                            that.send({event: message.type, message: message, graphId: graphId});
                        } else if (message.task === 'getAttributes') {
                            that.send({event: 'getAttributes', response: message.response});
                        }
                    }
                }
            };

            window.removeEventListener('message', window.messageListeners[graphId]);
            window.addEventListener('message', window.messageListeners[graphId]);

        },

        update: function() {
            // Listen for messages from the graph widget in python
            var jmessage = this.model.get('_message');
            var message = JSON.parse(jmessage);

            // check for duplicate messages
            if(!('messageIds' in window)){
                window.messageIds = {};
            }

            if(!(message.uid in window.messageIds)){
                // message hasn't been received yet, do stuff
                window.messageIds[message.uid] = true;

                if (message.fadeTo) {
                    this.fadeTo(message);
                } else {
                    var plot = $('#' + message.graphId)[0].contentWindow;
                    plot.postMessage(message, window.plotlyDomains[message.graphId]);
                }
            }

            return GraphView.__super__.update.apply(this);
        },

        /**
         * Wrapper for jquery's `fadeTo` function.
         *
         * @param message Contains the id we need to find the element.
         */
        fadeTo: function (message) {
            var plot = $('#' + message.graphId);
            plot.fadeTo(message.duration, message.opacity);
        }
    });

    // Register the GraphView with the widget manager.
//    manager.WidgetManager.register_widget_view('GraphView', GraphView);

    return {
        GraphView: GraphView
    }

});

//@ sourceURL=graphWidget.js
