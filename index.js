paper.install(window);

var NODE_CIRCLE_RADIUS = 10;
var NODE_CIRCLE_SPACING = 40;
var NODE_WIDTH = 100;

var NODE_DEFAULT_BODY_COLOR = 'black';
var NODE_DEFAULT_TERMINAL_COLOR = 'blue';
var NODE_DEFAULT_ACTIVE_TERMINAL_COLOR = 'red';

var edgeBeingDrawn = false;
var currentEdgeStart = null;

var allTerminals = [];

/* ============================== NODE START ================================ */
function Node(position, numInputs, numOutputs) {
    this._numInputs = numInputs;
    this._numOutputs = numOutputs;
    // Compute the width and height
    var inputHeight = NODE_CIRCLE_SPACING * (numInputs + 1);
    var outputHeight = NODE_CIRCLE_SPACING * (numOutputs + 1);
    var actualHeight = Math.max(inputHeight, outputHeight);

    this._rectangle = new Path.Rectangle(0, 0, NODE_WIDTH, actualHeight);
    this._rectangle.visible = true;
    this._rectangle.fillColor = NODE_DEFAULT_BODY_COLOR;
    this._inputCircles = [];
    this._outputCircles = [];

    this._bodyColor = NODE_DEFAULT_BODY_COLOR;
    this._terminalColor = NODE_DEFAULT_TERMINAL_COLOR;
    this._activeTerminalColor = NODE_DEFAULT_ACTIVE_TERMINAL_COLOR;

    var nodeThis = this;

    var mouseDragHandler = function(event) {
        if (!this.hasOwnProperty('_line')) {
            this._line = new Path.Line(this.position, event.point);
            this._line.visible = true;
            this._line.strokeColor = nodeThis._activeTerminalColor;
            this._line.strokeWidth = 2;
        }
        else {
            this._line.visible = true;
            this._line.removeSegments();
            this._line.addSegments([ this.position, event.point ]);
        }
        this.fillColor = nodeThis._activeTerminalColor;
        edgeBeingDrawn = true;
        currentEdgeStart = this;
    };

    var mouseUpHandler = function(event) {
        if (this.hasOwnProperty('_line')) {
            this._line.visible = false;
        }
        this.fillColor = nodeThis._terminalColor;
        edgeBeingDrawn = false;
    };

    for (var i = 0; i < numInputs; ++i) {
        var circle = new Path.Circle(new Point(0, NODE_CIRCLE_SPACING * (i + 1)), NODE_CIRCLE_RADIUS);
        circle.visible = true;
        circle.fillColor = nodeThis._terminalColor;
        this._inputCircles.push(circle);
        //circle.onMouseDrag = mouseDragHandler;
        //circle.onMouseUp = mouseUpHandler;
        var terminal = new Terminal(circle, Terminal.INPUT);
        allTerminals.push(terminal);
    }

    for (var i = 0; i < numOutputs; ++i) {
        var circle = new Path.Circle(new Point(NODE_WIDTH, NODE_CIRCLE_SPACING * (i + 1)), NODE_CIRCLE_RADIUS);
        circle.visible = true;
        circle.fillColor = nodeThis._terminalColor;
        this._outputCircles.push(circle);
        //circle.onMouseDrag = mouseDragHandler;
        //circle.onMouseUp = mouseUpHandler;
        var terminal = new Terminal(circle, Terminal.OUTPUT);
        allTerminals.push(terminal);
    }

    var elements = this._inputCircles.concat(this._outputCircles, [ this._rectangle ]);
    Group.call(this, elements);
    this.position = position;

    {
        this._rectangle.onMouseDrag = function(event) {
            nodeThis.position = nodeThis.position.add(event.delta);
            nodeThis._inputCircles.concat(nodeThis._outputCircles).forEach(function(circle) {
                if (circle.hasOwnProperty('_line')) {
                    var firstSegment = circle._line.removeSegment(0);
                    circle._line.insertSegment(0, firstSegment.point.add(event.delta));
                }
            });
        };
    }
}

Object.defineProperty(Node.prototype, 'bodyColor', {
    set: function(color) {
        this._bodyColor = color;
        this._rectangle.fillColor = color;
    },
});

Object.defineProperty(Node.prototype, 'terminalColor', {
    set: function(color) {
        this._terminalColor = color;
        this._inputCircles.concat(this._outputCircles).forEach(function(circle) {
            circle.fillColor = color;
        });
    },
});

Object.defineProperty(Node.prototype, 'activeTerminalColor', {
    set: function(color) {
        this._activeTerminalColor = color;
    },
});

Object.setPrototypeOf(Node.prototype, Group.prototype);
/* =============================== NODE END ================================= */

/* ============================ TERMINAL START ============================== */
function Terminal(path, type) {
    this._type = type;
    this._path = path;
    path._terminal = this;
    this._childConnections = [];
    this._parentConnection = null;
    this._connectionPaths = [];
    this._updated = false;

    if (type !== Terminal.INPUT && type !== Terminal.OUTPUT) {
        throw new TypeError('The type of a Terminal must either be an INPUT or an OUTPUT.');
    }

    path.onMouseEnter = function(event) {
        if (this._terminal._type !== Terminal.INPUT) {
            return;
        }

        if (Terminal.dragStart !== null && Terminal.dragStart !== this._terminal) {
            // we want to make a connection

            // for now, connections will be one-to-one, so we can have a
            // single variable in each terminal to the respective connection

            var terminal = this._terminal;
            
            if (terminal._parentConnection !== null) {
                return;
            }

            terminal._parentConnection = Terminal.dragStart;
            Terminal.dragStart._childConnections.push(terminal);

            var connectionPath = new Path.Line(
                Terminal.dragStart._path.position,
                terminal._path.position
            );
            connectionPath.visible = true;
            connectionPath.strokeColor = 'red';
            connectionPath.strokeWidth = 5;
            terminal._connectionPaths.push(connectionPath);
            Terminal.dragStart._connectionPaths.push(connectionPath);
        }
    };

    path.onMouseDrag = function(event) {
        if (this._terminal._type !== Terminal.OUTPUT) {
            return;
        }

        Terminal.dragStart = this._terminal;
        if (!this.hasOwnProperty('_line')) {
            this._line = new Path({
                segments: [ this.position, event.point ],
                strokeColor: 'red',
                strokeWidth: 5,
            });
            this._line.visible = true;
        } else {
            this._line.removeSegment(1);
            this._line.insert(1, event.point);
            this._line.visible = true;
        }
    };

    path.onMouseUp = function(event) {
        if (Terminal.dragStart === this._terminal) {
            Terminal.dragStart = null;
        }

        if (this.hasOwnProperty('_line')) {
            this._line.visible = false;
        }

        this.fillColor = 'blue';
    };

    path.onFrame = function() {
        var terminal = this._terminal;
        if (terminal._parentConnection !== null) {
            terminal._connectionPaths.forEach(function(path) {
                path.removeSegments();
                path.addSegments([ terminal._path.position, terminal._parentConnection._path.position ]);
                path.visible = true;
                path.fillColor = 'red';
            });
        }
        if (terminal._connectionPaths.length !== 0) {
            terminal._path.fillColor = 'red';
        } else {
            terminal._path.fillColor = 'blue';
        }
    };
}

Terminal.dragStart = null;

Terminal.INPUT = 0;
Terminal.OUTPUT = 1;
/* ============================= TERMINAL END =============================== */

window.onload = function() {
    paper.setup('main-canvas');

    var PADDING_X = 100;
    var PADDING_Y = 75;
    var TERMINAL_SPACING = 100;
    var NUM_INPUT_TERMINALS = 10;
    var NUM_OUTPUT_TERMINALS = 1;

    var newNodeButton = new Path.Rectangle(0, 0, 200, 50);
    newNodeButton.visible = true;
    newNodeButton.fillColor = 'black';

    var node = new Node(new Point(PADDING_X, PADDING_Y), 2, 1);
    var nodePosition = new Point(PADDING_X, PADDING_Y).add(node.bounds.size.multiply(0.5).add([ 50, 50 ]));
    node.position = nodePosition;

    newNodeButton.onMouseDown = function() {
        nodePosition = nodePosition.add(new Size(PADDING_X, PADDING_Y).multiply(0.5).add([ 50, 50 ]));
        var node = new Node(nodePosition, 2, 1);
    };

    var rectangle = new Path.Rectangle(PADDING_X, PADDING_Y, view.bounds.width - 2 * PADDING_X, view.bounds.height - 2 * PADDING_Y);
    rectangle.visible = true;
    rectangle.strokeColor = 'black';
    rectangle.strokeWidth = 5;
    rectangle.strokeJoin = 'round';

    var padding = new Point(PADDING_X, PADDING_Y);
    var offset = new Point(0, TERMINAL_SPACING);

    for (var i = 0; i < NUM_INPUT_TERMINALS; ++i) {
        var position = padding.add(offset.multiply(i + 1));
        var radius = 10;
        var circle = new Path.Circle(position, radius);
        circle.visible = true;
        circle.fillColor = 'blue';
        var terminal = new Terminal(circle, Terminal.OUTPUT);
    }

    view.onResize = function() {
        rectangle.bounds.width = this.bounds.width - 2 * PADDING_X;
        rectangle.bounds.height = this.bounds.height - 2 * PADDING_Y;
    };
};

