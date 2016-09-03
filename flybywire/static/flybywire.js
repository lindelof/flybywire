// Author: Thomas Antony
var v = require('virtual-dom')
var h = v.h
var diff = v.diff
var patch = v.patch
var createElement = v.create

var vdomjson = require('vdom-as-json');
var toJson = vdomjson.toJson;
var fromJson = vdomjson.fromJson;

var SOCKET_URL = "ws://127.0.0.1:9000"
var socket

function init() {
    rootDOM = null;      // Represents current virtual DOM tree
    rootElement = null;  // Represents current real DOM tree
    // rootEvents = {}      // Stores a list of all bound DOM events by node ID

    function render_from_json(dom_json) {
        newTree = fromJson(JSON.parse(dom_json));
        var patches = diff(rootDOM, newTree);
        rootElement = patch(rootElement, patches);
        rootDOM = newTree;
        bind_events();
    }
    function initialize_dom(dom_json) {
        rootDOM = fromJson(JSON.parse(dom_json));
        rootElement = createElement(rootDOM);     // Create DOM node ...
        document.body.appendChild(rootElement);    // add it to document
        bind_events();
    }
    function bind_events(){
        event_nodes = document.querySelectorAll('[fbwHasCallback]')
        for (i = 0; i < event_nodes.length; i++) {
            el = event_nodes[i];
            Object.keys(el.fbwEvents).forEach(function(evt) {
                cb = el.fbwEvents[evt]
                if (el.fbwCallbackId != cb){
                    // New callback
                    el.fbwCallbackListener = function(e){
                        cb = el['fbw'+evt.toUpperCase()]
                        send_dom_event(cb, e)
                    };
                    el.addEventListener(evt, el.fbwCallbackListener, false);
                    el.fbwCallbackId = cb
                }

            });
        }
    }
    function send_dom_event(callback_id, evt_obj){
        console.log('Triggering callback id'+String(callback_id));
        socket.send(JSON.stringify({ "event": "domevent",
                                     "callback": String(callback_id),
                                     "event_obj": getProperties(evt_obj),
                                    }))
    }
    socket = new WebSocket(SOCKET_URL)
    socket.onopen = function(event) {
        console.log("Connected to websocket server at " + SOCKET_URL)
        socket.send(JSON.stringify({ "event": "init" }))
    }

    socket.onmessage = function(event) {
        // console.log("Received: " + event.data)
        command = JSON.parse(event.data)
        if (command.name == "init") {
            initialize_dom(command.vdom)
            load()
        } else if (command.name == "render") {
            // Pull vdom data out of the event and render
            render_from_json(command.vdom)
        }
    }
}

function getAllPropertyNames(obj) {
    var props = [];

    do {
        props = props.concat(Object.getOwnPropertyNames(obj))
    } while (obj = Object.getPrototypeOf(obj))

    return props
}

function getProperties(obj) {
    newObj = {}
    props = getAllPropertyNames(obj)
    // console.log(obj)
    props.forEach(function(p) {
        propType = typeof obj[p]
        if (propType == "object") {
            if (obj[p] instanceof HTMLElement) {
                newObj[p] = { }
                newObj[p]['innerText'] = obj[p].innerText
                newObj[p]['outterText'] = obj[p].outterText
                newObj[p]['innerHTML'] = obj[p].innerHTML
                newObj[p]['outterHTML'] = obj[p].outterHTML
                newObj[p]['textContent'] = obj[p].textContent
                newObj[p]['value'] = obj[p].value

                for (var i = 0; i < obj[p].attributes.length; i++) {
                    newObj[p][obj[p].attributes[i].name] = obj[p].attributes[i].value
                }
            }
        }
        else if (propType != "function") {
            if (obj[p] != null)
                newObj[p] = obj[p].toString()
            else {
                newObj[p] = null
            }
        }
    })

    return newObj
}

function load() {
    socket.send(JSON.stringify({ "event": "load" }))
}

window.onload = function(event) {
    init()
}
