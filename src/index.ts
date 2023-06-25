console.log('Try npm run lint1!');

const canvas = <HTMLCanvasElement>document.getElementById('game');
const context = <CanvasRenderingContext2D>canvas.getContext('2d');
context.fillStyle = '#ff0000';
context.strokeStyle = '#ff0000';

type NodeId = number;

type AddNode = {
  type: 'AddNode';
  pos: Position;
};
type DeleteNode = {
  type: 'DeleteNode';
  node: GameNode;
};
type StartDrag = {
  type: 'StartDrag';
  node: GameNode;
};
type CancelDrag = {
  type: 'CancelDrag';
};
type ConnectNode = {
  type: 'ConnectNode';
  node: GameNode;
};

type Intent =
  | AddNode
  | DeleteNode
  | StartDrag
  | CancelDrag
  | ConnectNode;

class Position {
  x: number;
  y: number;
  constructor(_x: number, _y: number) {
    this.x = _x;
    this.y = _y;
  }

  copy() {
    return new Position(this.x, this.y);
  }

  distanceTo(other: Position): number {
    return Math.sqrt(
      Math.pow(other.x - this.x, 2) + Math.pow(other.y - this.y, 2)
    );
  }
}

class InputManager {
  pos?: Position;
  prev_clicked_buttons: number;
  clicked_buttons: number;
  constructor() {
    this.prev_clicked_buttons = 0;
    this.clicked_buttons = 0;
  }

  getIntent(world: WorldState): Intent | undefined {
    let intent: Intent | undefined = undefined;
    if (this.pos) {
      const closestNode = world.closestNode(this.pos);
      const distance = closestNode?.pos.distanceTo(this.pos);
      const buttonChanged = this.clicked_buttons !== this.prev_clicked_buttons;
      const isDragging = !!world.selectedNode;

      if (isDragging) {
        switch (this.clicked_buttons) {
          case 0: 
          if (closestNode && distance && distance < 10) {
            intent = {type: 'ConnectNode', node: closestNode};
          } else {
            intent = {type:'CancelDrag'}
          }
          break;
          case 3:
          case 2:
            intent = {type:'CancelDrag'}
            break;
          default:
            break;
        }
      } else if (buttonChanged) {
        switch (this.clicked_buttons) {
          case 1:
            if (!distance || distance > 30) {
              intent = {type: 'AddNode', pos: this.pos};
            } else if (closestNode && distance && distance < 15) {
              intent = {type: 'StartDrag', node: closestNode}
            }
            break;
          case 2:
            if (closestNode && distance && distance < 10) {
              intent = {type: 'DeleteNode', node: closestNode};
            }
            break;
        }
      }
    }
    this.prev_clicked_buttons = this.clicked_buttons;
    return intent;
  }
}

class GameNode {
  id: NodeId;
  pos: Position;
  connectedTo?: GameNode;
  constructor(_id: NodeId, _pos: Position) {
    this.id = _id;
    this.pos = _pos;
  }
}

class WorldState {
  currentId: NodeId;
  nodes: GameNode[];
  selectedNode?: GameNode;
  cursorPos?: Position;
  constructor() {
    this.currentId = 0;
    this.nodes = [];
  }

  closestNode(pos: Position): GameNode | undefined {
    if (!this.nodes.length) {
      return undefined;
    }
    const closestIndex = this.nodes
      .map(n => n.pos.distanceTo(pos))
      .reduce((r, v, i, a) => (v > a[r] ? r : i), -1);
    return this.nodes[closestIndex];
  }

  updateCursor(cursor?: Position) {
    this.cursorPos = cursor;
  }

  handleIntent(intent: Intent) {
    console.log(intent);
    switch (intent.type) {
      case 'AddNode':
        this.nodes.push(new GameNode(this.currentId++,intent.pos));
        break;
      case 'DeleteNode':
        const index = this.nodes.findIndex(n => n === intent.node);
        if (index >= 0) {
          this.nodes.splice(index, 1);
        }
        break;
      case 'StartDrag':
        this.selectedNode = intent.node;
        break;
      case 'CancelDrag':
        this.selectedNode = undefined;
        break;
      case 'ConnectNode':
        if (this.selectedNode && this.selectedNode !== intent.node) {
          this.nodes.filter(node => node.connectedTo === intent.node 
            || node.connectedTo === this.selectedNode).forEach(node => {
            node.connectedTo = undefined
          });
          this.selectedNode.connectedTo = intent.node;
          intent.node = this.selectedNode;
        }
        this.selectedNode = undefined;
        break;
    }
  }

  render(context: CanvasRenderingContext2D) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.save();
    context.fillStyle = '#000000';
    context.strokeStyle = '#efef00';
    context.lineCap = 'round';
    context.lineWidth = 5;
    if (this.selectedNode && this.cursorPos) {
      context.beginPath();
      context.moveTo(this.selectedNode.pos.x, this.selectedNode.pos.y);
      context.lineTo(this.cursorPos.x,this.cursorPos.y);
      context.stroke();
      context.closePath();
    }

    this.nodes.forEach(node => {
      context.fillStyle = '#000000';
      context.strokeStyle = '#ff0000';
      if (node.connectedTo) {
        context.beginPath();
        context.moveTo(node.pos.x, node.pos.y);
        context.lineTo(node.connectedTo.pos.x,node.connectedTo.pos.y);
        context.stroke();
        context.closePath();
      }
    })

    context.fillStyle = '#000000';
    context.strokeStyle = '#ff0000';
    this.nodes.forEach(node => {
      context.beginPath();
      context.arc(node.pos.x, node.pos.y, 10, 0, 2 * Math.PI);
      context.fill();
    });
    context.restore();
  }
}

const mouseState: InputManager = new InputManager();
const worldState: WorldState = new WorldState();

function updateMouse(evt: MouseEvent) {
  mouseState.clicked_buttons = evt.buttons;
  const rect = canvas.getBoundingClientRect();
  const pos = [evt.clientX - rect.left, evt.clientY - rect.top];
  const inCanvas =
    pos[0] >= 0 &&
    pos[0] <= canvas.width &&
    pos[1] >= 0 &&
    pos[1] <= canvas.height;
  mouseState.pos = inCanvas ? new Position(pos[0], pos[1]) : undefined;
}

document.onmousemove = updateMouse;
document.onmousedown = updateMouse;
document.onmouseup = updateMouse;
document.oncontextmenu = (ev: MouseEvent) => {
  updateMouse(ev);
  return false;
};

function maybeResize(
  context: CanvasRenderingContext2D,
  newSize: [number, number]
) {
  if (
    context.canvas.width === newSize[0] &&
    context.canvas.height === newSize[1]
  ) {
    return;
  }
  context.save();
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#ffffff';

  const temp_cnvs = document.createElement('canvas');
  const temp_cntx = <CanvasRenderingContext2D>temp_cnvs.getContext('2d');
  temp_cnvs.width = newSize[0];
  temp_cnvs.height = newSize[1];
  temp_cntx.fillStyle = context.fillStyle;
  temp_cntx.strokeStyle = context.strokeStyle;
  temp_cntx.fillRect(0, 0, newSize[0], newSize[1]);
  temp_cntx.drawImage(context.canvas, 0, 0);
  context.canvas.width = newSize[0];
  context.canvas.height = newSize[1];
  context.drawImage(temp_cnvs, 0, 0);
  context.restore();
}

function animate() {
  requestAnimationFrame(animate);
  maybeResize(context, [window.innerWidth, window.innerHeight]);

  const intent = mouseState.getIntent(worldState);
  worldState.updateCursor(mouseState.pos);
  if (intent) {
    worldState.handleIntent(intent);
  }
  worldState.render(context);
}

animate();
