// Зеркало PHP InterpreterNode.php: узел со служебным видом + поиск имени вида.
import {NodeType, ParseNode} from "./parser";
import {InterpreterNodeType} from "./interpreternodetype";

export class InterpreterNode extends ParseNode {
    get typeName() {
        // Порядок поиска как в PHP InterpreterNode::getTypeName(): сначала
        // NodeType (через родителя), затем InterpreterNodeType. Коды не
        // пересекаются (NodeType < 1000 ≤ InterpreterNodeType), поэтому
        // видимый результат тот же — выправляем именно порядок под зеркало.
        let k = Object.keys(NodeType),
            v = Object.values(NodeType);

        if (v.indexOf(this.nType) === -1) {
            k = Object.keys(InterpreterNodeType);
            v = Object.values(InterpreterNodeType);
        }

        return k[v.indexOf(this.nType)];
    }
}
