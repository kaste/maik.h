import { Observable } from '../node_modules/rxjs-es/Observable'
import { $$observable as observable } from '../node_modules/rxjs-es/symbol/observable'

const Symbol = {
  observable
}
const Rx = { Observable, Symbol }
export default Rx
