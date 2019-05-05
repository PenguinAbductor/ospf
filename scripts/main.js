$(document).ready(function() {
    /* init namespace */
    var init = function() {
    var canvas = {},
        steps = [], // copies of canvas at each stage of calculation
        confirmedHistory = [],  // copies of confirmed list
        timing = [];    // active timeouts
    
    /* Node subclass based on Circle class */
    fabric.Node = fabric.util.createClass(fabric.Circle, {
        type: "node",
        initialize: function(o) {
            this.callSuper("initialize", o);
            this.set("label", o.label || "X");  //custom
            this.set("isSource", o.isSource || false);     //custom
            this.set({
                radius: 18,
                padding: 25,
                centerScaling: true,
                hoverCursor: 'grab',
                moveCursor: 'grabbing'
            });
            if (o.isSource) {
                this.setColor("rgba(76, 175, 80, 0.75)");
            } else {
                this.setColor("rgba(0,51,204,0.7)");
            }
        },
        toObject: function() {
            return fabric.util.object.extend(this.callSuper("toObject"), {
                label: this.get("label"),
                isSource: this.get("isSource")
            });
        },
        _render: function(context) {
            this.callSuper("_render", context);
            context.font = "20px Monospace";
            context.fillStyle = "#ffffff";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(this.label, 0, 0);
        }
    });
    fabric.Node.fromObject = function(object, callback, forceAsync) {
        return fabric.Object._fromObject("Node", object, callback, forceAsync);
    };

    /* Link subclass based on Line class */
    fabric.Link = fabric.util.createClass(fabric.Line, {
        type: "link",
        initialize: function(coords, o) {
            this.callSuper("initialize", coords, o);
            this.set("cost", o.cost || fabric.util.getRandomInt(1, this.getUpperLimit())); // custom
            this.set("ends", o.ends); // custom
            this.set({
                stroke: "#aac933",
                strokeWidth: 3,
                opacity: 0.45,
                selectable: false,
                hoverCursor: "auto"
            });
        },
        toObject: function() {
            return fabric.util.object.extend(this.callSuper("toObject"), {
                cost: this.get("cost"),
                ends: this.get("ends"),
                x1: this.get("x1"),
                x2: this.get("x2"),
                y1: this.get("y1"),
                y2: this.get("y2")
            });
        },
        _render: function(context) {
            // console.dir(Object.getPrototypeOf(context));
            this.callSuper("_render", context);
            context.font = "18px sans-serif";
            context.fontWeight = 600;
            context.fillStyle = "#ff4e00";
            context.shadow = "rgba(100, 221, 23, 0.5) 2px 2px 4px";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(this.cost, 0, 0);
        }
    });
    fabric.Link.fromObject = function(object, callback, forceAsync) {
        object.points = [object.x1, object.y1, object.x2, object.y2];
        fabric.Object._fromObject("Link", object, callback, forceAsync, "points");
    };

    return {
        /* get dimensions of lower canvas */
        getDimensions: function(initialisation) {
            var dimensions = {};
            if (initialisation) {
                dimensions.height = $('#graph').height();
                dimensions.width = $('#graph').width();
            } else {
                dimensions.width = $("#graph").parent().parent().innerWidth();
                dimensions.height = 500;
            }
            return dimensions;
        },

        /* set properties commonly applicable to Fabric objects */
        config: function() {
            fabric.Object.prototype.originX = 'center';
            fabric.Object.prototype.originY = 'center';
            fabric.Object.prototype.hasControls = false;
            fabric.Object.prototype.lockUniScaling = true;
            fabric.Object.prototype.hasBorders = false;
            this.setupCanvas();
        },

        /* setup canvas object */
        setupCanvas: function() {
            var dimensions = this.getDimensions(true);
            var newCanvas = new fabric.Canvas('graph', {
                height: dimensions.height,
                width: dimensions.width,
                stopContextMenu: true,
                selection: false,
                containerClass: "mdl-card__media mdl-card--border",
                perPixelTargetFind: true,
                FX_DURATION: 124
            });
            canvas = newCanvas;
            this.setupCanvasEvents();
//            console.log("%s: %o", "Canvas Object", canvas);
        },

        /* adjust canvas width when viewport is resized */
        resizeCanvas: function() {
            var dimensions = init.getDimensions();
            var nodes = canvas.getObjects("node");
            var i;
            canvas.setDimensions({
                height: dimensions.height,
                width: dimensions.width
            });
            for (i=0; i<nodes.length; i+=1) {
                if (nodes[i].left<18 || nodes[i].left>dimensions.width-18 || nodes[i].top<18 || nodes[i].top>dimensions.height-18) {
                    init.displayNotification("space");
                    init.removeNode(nodes[i]);
                }
            }
        },

        /* add click event listener to Fabric canvas */
        setupCanvasEvents: function() {
            var maxNum = 26,
                srcNode,
                dstNode,
                isDrawingLink = false;
                var lastX, lastY;   // position before move
                /* when node is being moved... */
                canvas.on("object:moving", function(o) {
                    var nodes = this.getObjects("node");
                    var links = this.getObjects("links");
                    var obj = o.target;
                    var r = obj.radius,
                        x = obj.left,
                        y = obj.top,
                        w = canvas.width,
                        h = canvas.height,
                        minDistance = 2*r+44;

                    /* confined node within border */
                    if (x>w-r) {
                        obj.left = w-r;
                    }
                    if (x<r) {
                        obj.left = r;
                    }
                    if (y<r) {
                        obj.top = r;
                    }
                    if (y>h-r) {
                        obj.top = h-r;
                    }

                    for (var n=0; n<nodes.length; n+=1) {
                        var distance = Math.sqrt(Math.pow((x-nodes[n].left),2)+Math.pow(y-nodes[n].top,2));
                        if (distance > minDistance&&nodes[n]!==obj) {
                            lastX = x;
                            lastY = y;
                        } else if (distance < minDistance&&nodes[n]!==obj) {
                            init.displayNotification("position");
                            obj.setColor("rgba(204,0,0,0.4)");
                            // obj.lockMovementX = true;
                            // obj.lockMovementY = true;
                            obj.left = lastX;
                            obj.top = lastY;
                            obj.setColor("rgba(69, 131, 255, 0.94)");
                        }
                    }//for each node
                });//on object move
            canvas.on("mouse:down", function(o) {
                /* get objects whose type is 'node' */
                var nodes = canvas.getObjects("node");
                var all = canvas.getObjects();
                var nodeAmt = nodes.length;
                var x = o.e.layerX,
                    y = o.e.layerY,
                    w = canvas.width,
                    h = canvas.height;
                    //lastX = x;
                    //lastY = y;
                if (!o.e.shiftKey) {    // not holding Shift
                    if (nodeAmt === 0) {    // no nodes
                        init.createNode(x, y);
                    } else if (nodeAmt >= maxNum) { // too many
                        init.displayNotification("quota");
                        return;
                    } else if (x>w-18 || x<18 || y<18 || y>h-18) { // too close to border
                        init.displayNotification("position");
                        return;
                    } else if (!o.target&&nodeAmt < maxNum&&!o.e.altKey) { // not on a node & can add more
                        for (var i=0; i<all.length; i+=1) {
                            var distance = Math.sqrt(Math.pow(x-all[i].left,2)+Math.pow(y-all[i].top,2));
                            if (distance < all[i].radius*2+48) { // too close to another
                                init.displayNotification("position");
                                return;
                            }
                        }
                        init.createNode(x, y);
                        if (canvas.getObjects("node").length === maxNum) {  // enough
                            canvas.setCursor("auto");
                        }
                    }
                } else if (o.target&&o.target.type==="node"&&o.e.shiftKey&&!o.e.altKey) {  // on a node holding Shift
                    srcNode = o.target;
                    isDrawingLink = true;  // signal linking operation starts
                    init.renderGuideline(o.target, o.e);
//                    console.log("Pulling from", o.target.label);
                }
            });// on mouse down
            canvas.on("mouse:move", function(o) {
                var nodeAmt = canvas.getObjects("node").length;
                if (isDrawingLink) {
                    this.setCursor("crosshair");
                    init.updateGuideline(o.e);
                }
            });//on mouse move
            canvas.on("mouse:up", function(o) {
                var guideline = canvas.getObjects("line")[0];
                if (o.target&&o.target.type==="node") { // released on top of a node object
                    dstNode = o.target; // set destination (might not use)
                    if (srcNode&&srcNode!==o.target) {  // origin established & destination isn't origin
                        if(init.linkNodes(srcNode, o.target)) {
                            init.displayNotification("repeat", [srcNode.label, o.target.label]);
                        }
                    }
//                    console.log("Released on", o.target.label);
                    srcNode = null;
                }
                isDrawingLink = false; // signal linking operation ends
                canvas.remove(guideline);
            });
            /* canvas.on("mouse:over", function(o) {
				var obj = o.target;
                if (o.target&&o.target.type === "link") {
                    init.displayNotification("tooltip", o.target.cost);
                }
                if (o.target && o.target.type === "node") {
					if (o.target.isSource) {
						o.target.set
					} else {
						o.target.setColor("rgba(0, 51, 204, 0.7)");
					}
                }
            });
            canvas.on("mouse:out", function(o) {
            }); */
        },

        /* get next available character to be used as label of new node */
        getIndex: function() {
            /* Get all letters being used */
            var nodes = canvas.getObjects("node"),
                usedChars = [],
                len = canvas.getObjects("node").length;
            if (len === 0) {
                return "A";
            }
            var i;
            for (i=0; i<len; i+=1) {
                usedChars.push(nodes[i].label);
            }
//            usedChars.sort();
            var j;
            for (j=65; j<91; j+=1) {
                if (usedChars.indexOf(String.fromCharCode(j)) === -1) {
                    return String.fromCharCode(j);
                }
            }
        },

        /* create node as Node object */
        createNode: function(left, top) {
            var node = new fabric.Node({
                left: left,
                top: top,
                label: this.getIndex()
            });
            canvas.add(node);
//            console.log(node);
            this.setupNodeClicks(node);
        },
		
        /* make one node source node */
		assignSource: function(node) {
			var nodes = canvas.getObjects("node");
			var replaced;
			for (var i=0; i<nodes.length; i+=1) {
				if (nodes[i].isSource===true) {
					replaced = nodes[i];
					break;
				}
			}
			if (!replaced) {
				node.isSource = true;
				node.setColor("rgba(76, 175, 80, 0.75)");
				return;
			} else if (replaced===node) {
				return;
			} else {
				replaced.isSource = false;
				replaced.setColor("rgba(0,51,204,0.7)");
				node.isSource = true;
				node.setColor("rgba(76, 175, 80, 0.75)");
			}
		},

        /* remove node */
        removeNode: function(node) {
            var links = canvas.getObjects("link");
            for (var i=0; i<links.length; i+=1) {
                if (node.label === links[i].ends[0] || node.label === links[i].ends[1]) {
                    this.removeLink(links[i]);
                }
            }
            canvas.fxRemove(node);
        },

        /* remove link */
        removeLink: function(link) {
            canvas.fxRemove(link);
        },

        /* add click event listener for the received node */
        setupNodeClicks: function(node) {
            var nodes = canvas.getObjects("nodes");
            var associatedLinks = [];   // all links connected to the active node
            node.on("mousedown", function(o) {
                var links = canvas.getObjects("link");
                for (var i=0; i<links.length; i+=1) {
                    if (this.label === links[i].ends[0] || this.label === links[i].ends[1]) {
                        // console.log("Connected to", links[i]);
                        if (this.left === links[i].x1 && this.top === links[i].y1) {
                            links[i].whichEnd = 1;
                        } else if (this.left === links[i].x2 && this.top === links[i].y2) {
                            links[i].whichEnd = 2;
                        }
                        associatedLinks.push(links[i]);
                        // console.log(associatedLinks);
                    }
                }
                if (o.e.shiftKey) {
                    this.lockMovementX = true;
                    this.lockMovementY = true;
                    this.hoverCursor ="crosshair";
                } else {
                    this.setShadow("2px 4px 10px rgba(0,0,0,0.5)");
                }
            });// on mousedown
            node.on("mouseover", function (o) {
				if (this.isSource) {
					this.setColor("rgba(139, 195, 74, 0.75)");
				} else {
					this.setColor("rgba(69,131,255,0.94)");
				}
                if(o.e.shiftKey) {
                    this.lockMovementX = true;
                    this.lockMovementY = true;
                    this.hoverCursor ="crosshair";
                } else {
                    this.lockMovementX = false;
                    this.lockMovementY = false;
                    this.hoverCursor = "grab";
                }
				canvas.renderAll();
            });
            node.on("mouseup", function (o) {
                this.setShadow(0);
                if (o.e.altKey) {	// Alt pressed
					if (o.e.shiftKey) {	// and Shift
						init.assignSource(this);
						canvas.renderAll();
					} else {	// just Alt
						init.removeNode(this);
					}
                }
                this.lockMovementX = false;
                this.lockMovementY = false;
                associatedLinks.length = 0;
            });// on mouseup
            node.on("mouseout", function (o) {
                if (this.isSource) {
                    this.setColor("rgba(76, 175, 80, 0.75)");
                } else {
                    this.setColor("rgba(0,51,204,0.7)");
                }
                canvas.renderAll();
            });
            node.on("moving", function(o) {
                for (var l=0; l<associatedLinks.length; l+=1) {
                    // console.log("Left: ",this.left,associatedLinks[l].x1,associatedLinks[l].x2);
                    if (associatedLinks[l].whichEnd === 1) {
                        associatedLinks[l].set({
                            x1: this.left,
                            y1: this.top
                        });
                        canvas.renderAll();
                    } else if (associatedLinks[l].whichEnd === 2) {
                        associatedLinks[l].set({
                            x2: this.left,
                            y2: this.top
                        });
                        canvas.renderAll();
                    }
                }
            });
        },

        /* clear canvas */
        clearCanvas: function() {
            $("#routing_table").empty();
            steps.length = 0;
            confirmedHistory.length = 0;
            canvas.clear();
        },

        /* render guideline between node and cursor */
        renderGuideline: function(src, pointer) {
            var x1 = src.left,
                y1 = src.top,
                x2 = pointer.layerX,
                y2 = pointer.layerY;
            var guide = new fabric.Line([x1, y1, x2, y2], {
                stroke: "#aac933",
                strokeDashArray: [9, 4],
                selectable: false,
                strokeWidth: 3,
                opacity: 0.65
            });
            canvas.add(guide);
        },

        /* keep guideline end at pinter */
        updateGuideline: function(pointer) {
            var guideline = canvas.getObjects("line")[0];
            guideline.set({
                x2: pointer.layerX,
                y2: pointer.layerY
            });
            canvas.renderAll();
        },

        /* connect nodes */
        linkNodes: function(src, dst) {
            var links = canvas.getObjects("link");
            var ends = [src.label, dst.label].sort();
            var cost;
            var i;
            for (i=0; i<links.length; i+=1) {
                if (ends[0] === links[i].ends[0] && ends[1] === links[i].ends[1]) { // same link exists
                    return true;
                }
            }
            if ($("#random").prop("checked")) {
                cost = init.getInput("random");
            } else {
                cost = init.getInput("cost");
            }
            if (!cost) {    // cancelled input
                return;
            }
            var o = {ends: ends, cost: cost};
            var link = new fabric.Link([src.left, src.top, dst.left, dst.top], o);
            canvas.add(link);
            this.setupLinkClicks(link);
            canvas.sendToBack(link);
        },

        /* add link event listeners */
        setupLinkClicks: function(link) {
            link.on("mousedown", function(o) {

            });
            link.on("mouseup", function(o) {
                var originalCost;
                if(o.e.altKey) {
                    init.removeLink(this);
                } else if (o.e.shiftKey) {
                    originalCost = this.cost;
                    this.set({
                        cost: init.getInput("cost", originalCost) || originalCost
                    });
					this.dirty = true;	// include in next render call
					canvas.renderAll();
                }
            });
			link.on("mouseover", function(o) {
				this.setShadow("2px 2px 5px rgba(230,81,0,0.5)");
				init.setTooltip("Cost: " + this.cost);
                init.displayNotification("tooltip", this.cost);
				canvas.renderAll();
			});
			link.on("mouseout", function(o) {
				this.setShadow(0);
				init.setTooltip();
				canvas.renderAll();
			});
        },
		
        /* setup tooltips on canvas element */
		setTooltip: function(content){
			if (content) {
				$("#graph").parent().attr("title", content);
			} else {
				$("#graph").parent().removeAttr("title");
			}
		},

        /* add a row containing information of newly created edge to table */
		fillTable: function(confirmed) {
		    var headerRow = $("<tr><th class='mdl-data-table__cell--non-numeric'>Destination</th><th>Cost</th><th>Previous Vertex</th></tr>");
		    $("#routing_table").empty();
		    $("#routing_table").append(headerRow);
		    var i, len = confirmed.length;
		    for (i = 0; i < len; i += 1) {
		        var row = $("<tr></tr>").append("<td class='mdl-data-table__cell--non-numeric'>" + confirmed[i].destination.label + "</td>").append("<td>" + confirmed[i].cost + "</td>").append("<td>" + confirmed[i].prev.destination.label + "</td>");
		        $("#routing_table").append(row);
		    }
            
        },       

        /* list saved canvas */
        listNetworks: function() {
            $("#networks").empty();
            /* check if any networks exist in local storage */
            var i,
                len = localStorage.length;
            if (len===0) {
                console.info("No network found in local storage");
                $("#networks").prepend('<i class="mdl-chip__contact material-icons">error</i><span class="mdl-chip__text">Storage empty</span></span>');
                return false;
            }
            for (i=0; i<len; i+=1) {
                if (localStorage.key(i).slice(0, 5) === "ospf-") {
                    break;
                } else if (i===len-1) {
                    console.info("No network found in local storage");
                    $("#networks").prepend('<i class="mdl-chip__contact material-icons">error</i><span class="mdl-chip__text">Storage empty</span></span>');
                    return false;
                }
            }
            var network = {},
                delBtn = {};
            for (var item in localStorage) {
                if (item.slice(0, 5) === 'ospf-') {
                    network = $('<span class="mdl-chip mdl-chip--deletable"><span class="mdl-chip__text">' + item.slice(5) + '</span><a href="#" class="mdl-chip__action" title="Delete"><i class="material-icons">delete_forever</i></a></span>');
                    $(network).children(".mdl-chip__text").click(function(param) {
                        return function() {
                            init.retriveCanvas(param);
                        }
                    }(item));
                    $(network).children(".mdl-chip__action").click(function(del) {
                        return function() {
                            init.deleteNetwork(del);
                        }
                    }(item));
                    $('#networks').append(network);
                }
            }
        },

        /* save canvas to local storage */
        saveCanvas: function() {
            if (canvas.getObjects().length < 1) {
                if (!confirm("Nothing has been added, save anyway?")) {
                    return false;
                }
            }
            var name = "",
                data = "";
            do {
                name = init.nameNetwork(name.reason, name.input);
            } while (name && typeof name!=="string");
            /* Cancel saving if returned false */
            if (!name) {
                return false;
            }
            canvas.set("title", name);
            data = JSON.stringify(canvas);
            localStorage.setItem('ospf-' + name, data);
            init.listNetworks();
        },

        /* validate network naming input */
        nameNetwork: function(reason, lastInput) {
            var input = "";
            switch(reason) {
                case "empty":
                    input = prompt("Name cannot be empty", "Unnamed network");
                    break;
                case "taken":
                    input = prompt('"'+lastInput + "\" has been used, choose a different name", lastInput);
                    break;
                default:
                    input = prompt("Network Name:", canvas.title || "New network");
            }
            if (input === null) {
                return false;
            } else if (!input) {
                return {reason: "empty", input: input};
            } else if (localStorage["ospf-"+input] !== undefined) {
                if (confirm('"'+input+"\" already exists. Do you want to replace it?")) {
                    return input;
                } else {
                    return {reason: "taken", input: input};
                }
            } else {
                return input;
            }
        },

        /* load saved canvas from local storage */
        retriveCanvas: function(name) {
            $("#routing_table").empty();
            steps.length = 0;
            confirmedHistory.length = 0;
            canvas.loadFromJSON(localStorage.getItem(name), function() {
                canvas.renderAll();
            });
            canvas.set("title", name.slice(5));
            canvas.setCursor("auto");
            /* get all objects and add appropriate event listeners by type */
            var all = canvas.getObjects();
            for (var i=0; i<all.length; i+=1) {
                if (all[i].type==="node") {
                    this.setupNodeClicks(all[i]);
                } else if (all[i].type==="link") {
                    this.setupLinkClicks(all[i]);
                }
            }
        },
        
        /* export network as a text string */
        exportNetwork: function() {
            if (canvas.getObjects().length < 1) {
                init.displayNotification("num");
                return false;
            }
            $("#export").parent().parent().slideDown();
            $("#export").text(JSON.stringify(canvas)).select();
            document.execCommand("copy");
            $("#export").focusout(function() {
                $(this).parent().parent().slideUp();
            });
            init.displayNotification("output");
        },
        
        /* load external network */
        importNetwork: function() {
            var load = prompt("Please paste in network data");
            if (load=== null) {
                return false;
            } else if (!load) {
                init.displayNotification("noinput");
                return false;
            }
            $("#routing_table").empty();
            steps.length = 0;
            confirmedHistory.length = 0;
            canvas.loadFromJSON(load, function() {
                canvas.renderAll();
            });
            var all = canvas.getObjects();
            for (var i=0; i<all.length; i+=1) {
                if (all[i].type==="node") {
                    init.setupNodeClicks(all[i]);
                } else if (all[i].type==="link") {
                    init.setupLinkClicks(all[i]);
                }
            }
            init.saveCanvas();
        },
        
        /* delete network from local storage */
        deleteNetwork: function(name) {
            localStorage.removeItem(name);
            this.listNetworks();
        },

        /* get cost input */
        getInput: function(purpose, value) {
            var input;
            switch(purpose) {
                case "cost":
                    if (value) {
                        rawInput = prompt("Please enter the cost for this edge (1~10)", value);
                    } else {
                        rawInput = prompt("Please enter the cost for this edge (1~10)", "<Random value>");
                    }
                    if (rawInput === null) {
                        return false;
                    }
                    input = parseInt(rawInput);
                    if (isNaN(input) || input<1 || input>this.getUpperLimit()) {
                        input = fabric.util.getRandomInt(1, this.getUpperLimit());
                        this.displayNotification("range", input);
                    }
                    break;
                case "random":
                    input = fabric.util.getRandomInt(1, this.getUpperLimit());
                    this.displayNotification("range", input);
                    break;
                default:
                    return false;
            }
            return input;
        },
        
        /* display notifications */
        displayNotification: function(reason, val) {
            var title;
            switch(reason) {
                case "quota":
                    console.warn("Maximum number of nodes reached");
                    this.displaySysNotification("Unable to add more nodes", {body: "Maximum number of nodes reached", icon: "assets/ospf.png", tag: "max"});
                    canvas.setCursor("not-allowed");
                    break;
                case "position":
                    console.warn("Too close to border or other nodes");
                    this.setTooltip("Too close to border or other nodes");
                    this.displaySysNotification("Too close to border or other nodes", {body: "Please click on a wider empty area", icon: "assets/ospf.png", tag: "close"});
                    canvas.setCursor("not-allowed");
                    break;
                case "space":
                    console.warn("Some nodes have been removed due to insufficient space");
                    this.displaySysNotification("Insufficient display area", {body: "Some nodes have been removed", icon: "assets/ospf.png", tag: "space"});
                    break;
                case "repeat":
                    console.warn("Already linked");
                    this.displaySysNotification("A link already exists", {body: val[0]+" and "+val[1]+" are already connected", icon: "assets/ospf.png", tag: "linked"});
                    break;
                case "range":
                    console.warn("Using random number");
                    this.displaySysNotification("Using random cost", {body: "Cost set to " + val, icon: "assets/ospf.png", tag: "input"});
                    break;
				case "tooltip":
					console.warn("Cost of this link:", val);
                    /*this.displaySysNotification("Cost of this link is " + val, {body:"Cost of this link is " + val, icon: "assets/ospf.png", tag: "cost"});*/
					break;
                case "source":
                    console.warn("Assigned %s as source node", val);
                    this.displaySysNotification("Source not specified", {body: "Assigned " + val + " as source node", icon: "assets/ospf.png", tag: "source"});
                    break;
                case "num":
                    console.warn("No network structure detected");
                    this.displaySysNotification("No network structure detected", {body: "Please create or load a network first", icon: "assets/ospf.png", tag: "no-network"});
                    break;
                case "step":
                    this.displaySysNotification("New iteration", {body: "Moved "+val+" to Confirmed list", icon: "assets/ospf.png", tag: "step"});
                    break;
                case "finished":
                    console.warn("Calculation complete");
                    this.displaySysNotification("Calculation complete", {body: "Route to all destinations found", icon: "assets/ospf.png", tag: "complete"});
                    break;
                case "output":
                    console.warn("Export data generated");
                    this.displaySysNotification("Ready to export", {body: "Network data copied to system clipboard", icon: "assets/ospf.png", tag: "export"});
                    break;
                case "noinput":
                    console.warn("No data provided");
                    this.displaySysNotification("No data provided", {body: "Please paste the network data in the textbox", icon: "assets/ospf.png", tag: "nodata"});
                    break;
                case "nosteps":
                    console.warn("No steps in memory");
                    this.displaySysNotification("No history to step through", {body: "Please perform route calculation first", icon: "assets/ospf.png", tag: "nosteps"});
                    break;
                case "reset":
                    console.warn("Network reset");
                    this.displaySysNotification("Network reset", {body: "The Network has been restored to its initial state", icon: "assets/ospf.png", tag: "reset"});
                    break;
                default:
                    console.warn("Something");
            }
        },
        
        /* get source node */
        getSource: function() {
            var nodes = canvas.getObjects("node"),
                len = nodes.length,
                source,
                i;
            for (i=0; i<len; i+=1) {
                if (nodes[i].isSource) {
                    source = nodes [i];
                    break;
                }
            }
            /* if no source assigned, use random */
            if (!source) {
                source = nodes[fabric.util.getRandomInt(0, len-1)];
                source.isSource = true;
                source.setColor("rgba(76, 175, 80, 0.75)");
                source.dirty = true;
                canvas.renderAll();
                this.displayNotification("source", source.label);
            }
            return source;
        },
        
        /* save state of the algorithm calculation */
        snapshot: function(confirmed) {
            if (canvas.getObjects.length < 1) {
                return false;
            }
            var state = JSON.stringify(canvas);
            var copyConfirmed = confirmed.slice();
            steps.push(state);
            confirmedHistory.push(copyConfirmed);
        },

        /* calculate shortest path */
        calc: function(step) {
            var links = canvas.getObjects("link");
            var nodes = canvas.getObjects("node");
            var getNodeByLabel = function(label) {
                var i, len = nodes.length;
                for (i=0; i<len; i++) {
                    if (nodes[i].label === label) {
                        return nodes[i];
                    }
                }
                return false;                
            };
            if (links.length<1) {
                init.displayNotification("num");
                return false;
            }
            $("#calc").prop("disabled", true).slideUp();
            $("#step").prop("disabled", true).slideUp();
            $("#interrupt").prop("disabled", false).show();
            $("#progress").addClass("mdl-progress--indeterminate").slideDown();
            var tentative = [],
                confirmed = [],
                neighbour,
                nCost,
                next;
            var isNotOnTentative = function(node) {
                var i, len = tentative.length;
                for (i=0; i<len; i+=1) {
                    if (node.label === tentative[i].destination.label) {
                        return false;
                    }
                }
                return true;
            };
            var isNotOnConfirmed = function(node) {
                var i, len = confirmed.length;
                for (i=0; i<len; i+=1) {
                    if (node.label === confirmed[i].destination.label) {
                        return false;
                    }
                }
                return true;
            };
            var listedCostFor = function(node) {
                var i, len = tentative.length;
                for (i=0; i<len; i+=1) {
                    if (tentative[i].destination.label === node.label) {
                        return tentative[i].cost;
                    }
                }
            };
            var updateTentativeEntry = function(node) {
                var i, len = tentative.length;
                for (i=0; i<len; i+=1) {
                    if (tentative[i].destination.label === node.label) {
                        tentative[i].cost = nCost;
                        tentative[i].prev = next;
                    }
                }
            };
            var markAsConfirmed = function(node) {
                var shadow = "";
                if (node.isSource) {
                    shadow = "6px 6px 10px rgba(76, 175, 80, 0.75)";
                } else {
                    shadow = "6px 6px 10px rgba(0, 51, 204, 0.68)";
                }
                node.setShadow(shadow);
                /*node.set({
                    "fill": "#00BCD4",
                    "shadow": shadow
                });*/
            };
            var examineNode = function (node) {
                node.setShadow("7px 7px 10px rgba(255, 0, 0, 0.8)");
                node.animate('angle', '360', {
                    onChange: canvas.renderAll.bind(canvas),
                    duration: 4000,
                    easing: fabric.util.ease.easeOutElastic
                });
            };
            var sourceNode = init.getSource();
            var iterate = function() {
                /* clear shadow */
                if (next) {
                    next.destination.setShadow(0);
                }
                /* set last confirmed as 'Next' */
                next = confirmed[confirmed.length-1];
                if (step) {
                    examineNode(next.destination);
                }
                init.snapshot(confirmed);
                for (var i=0; i<links.length; i++) {    //
                    if (links[i].ends[0] === next.destination.label) {
                        neighbour = getNodeByLabel(links[i].ends[1]);
                        links[i].setShadow("2px 2px 5px rgba(230,81,0,0.8)");
                    } else if (links[i].ends[1] === next.destination.label) {
                        neighbour = getNodeByLabel(links[i].ends[0]);
                        links[i].setShadow("2px 2px 5px rgba(230,81,0,0.8)");
                    } else {
                        continue;   // skip to next iteration if not a neighbour
                    }
                    
                    /* cost to reach this neighbour */
                    nCost = confirmed[confirmed.length-1].cost + links[i].cost;
                    
                    if (isNotOnConfirmed(neighbour) && isNotOnTentative(neighbour)) {
                        /* not on either list */
                        neighbour.setShadow("5px 5px 10px rgba(255, 78, 0, 0.83)");
                        init.snapshot(confirmed);
                        tentative.push({destination: neighbour, cost: nCost, prev: next});
                    } else if (!isNotOnTentative(neighbour) && listedCostFor(neighbour) > nCost) {
                        /* on Tentative list and cost lower than previously listed*/
                        neighbour.setShadow("5px 5px 10px rgba(78, 0, 255, 0.83)");
                        init.snapshot(confirmed);
                        updateTentativeEntry(neighbour);
                    }
                }// for each neighbour
                
                if (tentative.length === 0) {   // route for all destinations found
                    init.displayConfirmed(confirmed);
                    init.displayNotification("finished");
                    (function(){
                        var i, len = nodes.length;
                        for (i=0; i<len; i++) {
                            nodes[i].setShadow(0);
                        }
                        canvas.renderAll();
                        confirmedHistory.push(confirmed);
                        steps.push("head");
                    }());   // remove shadow beneath all nodes
                    /* sort route by node lable */
                    confirmed.sort(function(a, b) {
                        return a.destination.label > b.destination.label;
                    });
                    if (step) {
                        timing.push(setTimeout(function() {
                            init.displayConfirmed(confirmed);
                            $("#progress").removeClass("mdl-progress--indeterminate").slideUp();
                            $("#calc").prop("disabled", false).slideDown();
                            $("#step").prop("disabled", false).slideDown();
                            $("#interrupt").prop("disabled", true).hide();
                        }, 4000));
                    } else {
                        init.displayConfirmed(confirmed);
                        $("#progress").removeClass("mdl-progress--indeterminate").slideUp();
                        $("#calc").prop("disabled", false).slideDown();
                        $("#step").prop("disabled", false).slideDown();
                        $("#interrupt").prop("disabled", true).hide();
                    }
                } else {    // Tentative list not empty
                    tentative.sort(function(a, b) {
                        return a.cost > b.cost;
                    });
                    /* move lowest cost node to Confirmed list */
                    confirmed.push(tentative[0]);
                    if (step) {
                        init.displayConfirmed(confirmed);
                        markAsConfirmed(tentative[0].destination);
                        console.log("Moving %s to Confirmed", tentative[0].destination.label);
                        init.displayNotification("step", tentative[0].destination.label);
                    }
                    tentative.shift();
                    if (step) {
                        init.snapshot(confirmed);
                        timing.push(setTimeout(iterate, 4000));
                    } else {
                        init.snapshot(confirmed);
                        iterate();
                    }
                }
            };
            /* initialise Confirmed list*/
            /* clear steps */
            steps.length = 0;
            confirmedHistory.length = 0;
            init.snapshot(confirmed);
            confirmed.push({destination: sourceNode, cost: 0, prev: {destination: {label: "N/A"}}});
            init.displayConfirmed(confirmed);
            if (step) {
                console.log("Moving %s to Confirmed", confirmed[0].destination.label);
                markAsConfirmed(confirmed[0].destination);
                init.displayNotification("step", confirmed[0].destination.label);
                timing.push(setTimeout(iterate, 4000));
            } else {
                iterate();
            }
        },
        
        /* load network stage */
        loadNetworkStage: function(direction) {
            if (steps.length < 2 && direction!=="reset") {
                init.displayNotification("nosteps");
                return false;
            }
            var current = steps.indexOf("head");
            if (direction === "prev"&&steps[current-1]) {
                /* save current state */
                steps[current] = JSON.stringify(canvas);
                /* load previous stage */
                canvas.loadFromJSON(steps[current-1], function() {
                    canvas.renderAll();
                });
                canvas.setCursor("auto");
                var all = canvas.getObjects();
                for (var i=0; i<all.length; i+=1) {
                    if (all[i].type==="node") {
                        this.setupNodeClicks(all[i]);
                    } else if (all[i].type==="link") {
                        this.setupLinkClicks(all[i]);
                    }
                }
                /* set head */
                steps[current-1] = "head";
                /* update table */
                init.displayConfirmed(confirmedHistory[current-1]);
            } else if (direction === "next"&&steps[current+1]) {
                /* save current state */
                steps[current] = JSON.stringify(canvas);
                /* load next stage */
                canvas.loadFromJSON(steps[current+1], function() {
                    canvas.renderAll();
                });
                canvas.setCursor("auto");
                var all = canvas.getObjects();
                for (var i=0; i<all.length; i+=1) {
                    if (all[i].type==="node") {
                        this.setupNodeClicks(all[i]);
                    } else if (all[i].type==="link") {
                        this.setupLinkClicks(all[i]);
                    }
                }
                /* set head */
                steps[current+1] = "head";
                /* update table */
                init.displayConfirmed(confirmedHistory[current+1]);
            } else if (direction === "reset" && steps[0]) {    // load initial state
                for (var t=0; t < timing.length; t++) {
                    clearTimeout(timing[t]);
                }
                timing.length = 0;
                canvas.loadFromJSON(steps[0], function() {
                    canvas.renderAll();
                });
                canvas.setCursor("auto");
                var all = canvas.getObjects();
                for (var i=0; i<all.length; i+=1) {
                    if (all[i].type==="node") {
                        this.setupNodeClicks(all[i]);
                    } else if (all[i].type==="link") {
                        this.setupLinkClicks(all[i]);
                    }
                }
                $("#progress").removeClass("mdl-progress--indeterminate").slideUp();
                $("#calc").prop("disabled", false).slideDown();
                $("#step").prop("disabled", false).slideDown();
                $("#interrupt").prop("disabled", true).hide();
                $("#routing_table").empty();
                init.displayNotification("reset");
            }
        },
        
        /* display confirmed list content */
        displayConfirmed: function(confirmed) {
            var len = confirmed.length,
                i;
            this.fillTable(confirmed);
            for (i=0; i<len; i++) {
                console.info("Destination: %s; Cost: %d; Previous vertex: %s", confirmed[i].destination.label, confirmed[i].cost, confirmed[i].prev.destination.label);
            }
        },
        
        /* request for permission to use built-in notifications */
        requestNotificationPermission: function() {
            if (!("Notification" in window)) {
                console.warn("Built-in notification not supported");
                return false;
            } else {
                Notification.requestPermission();
            }
        },
        
        displaySysNotification: function(title, content) {
            if (("Notification" in window) && Notification.permission === "granted") {
                var sysNotification = new Notification(title, content);
                setTimeout(function() {
                    sysNotification.close();
                }, 4000);
            } else if (content.tag !== "close" && content.tag !=="cost") {
                var snackbar = $(".mdl-js-snackbar")[0];
                snackbar.MaterialSnackbar.showSnackbar({
                    message: content.body
                });
            }
        },
        
        /* get maximum cost allowed */
        getUpperLimit: function() {
            var maxCost = $("#cost").val();
            return maxCost;
        },
        
        /* update maximum cost allowed */
        updateCostLimit: function(param) {
            $("#cost").parent().prev("span").text("Maximum cost: " + param);
        },
        
        /* toggle visibility between canvas & LSP iframe */
        toggleCanvas: function() {
            var frame = $("#lsp_window").children("iframe");
            if (!$(frame).attr("src")) {
                $(frame).attr("src", "lsp.html");
            }
            $("#graph").parent().toggle();
            $("#lsp_window").toggle();
        }
        
    }; //return all methods
}(); //init
    init.requestNotificationPermission();
    
    /* initialise canvas configuration */
    init.config();
    /* (optionally) display networks stored in local storage */
    init.listNetworks();
    /* Make canvas dimension responsive */
    $(window).resize(init.resizeCanvas);

    /* Button actions */
    $("#clear-canvas").click(function() {
        init.clearCanvas();
    });
    $("#import-canvas").click(init.importNetwork);
    $("#save-canvas").click(init.saveCanvas);
    $("#export-canvas").click(init.exportNetwork);
    $("#calc").click(function() {
        init.calc(false)
    });
    $("#step").click(function() {
        init.calc(true);
    });
    $("#prev").click(function() {
        init.loadNetworkStage("prev");
    });
    $("#next").click(function() {
        init.loadNetworkStage("next");
    });
    $("#reset").click(function() {
        init.loadNetworkStage("reset");
    });
    $("#interrupt").click(function() {
        init.loadNetworkStage("reset");
    });
    $("#cost").on("input", function() {
        init.updateCostLimit(this.value);
    });
    $("#toggle").click(init.toggleCanvas);
});//on document ready
