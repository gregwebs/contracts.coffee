{makeIdHandler, merge, numUnaryOps, numBinaryOps} = require './utils'
fj = require "./flapjax"
secret = {}

root = exports ? this

Unit = ?!(x) -> x is undefined
FlapjaxBehavior = ?!(x) -> x instanceof fj.Behavior
Reactive = ?!(x) -> if Proxy.unProxy secret, x then true else false
# todo: want the following Reactive contract but I think some bug in contracts.js or
# V8 is causing issues with putting an object contract on a Proxy
# Reactive = ?{
#   set: (Num) -> Unit
#   curr: -> Num
# }

reactive :: (Any) -> Reactive
reactive = (x) -> 
  if x instanceof fj.Behavior
    b = x
  else
    # convert our normal value to a behavior
    b = fj.startsWith fj.receiverE(), x

  handler = merge makeIdHandler(),
    beh: b
  
  handler.unary = (o) ->
    reactive (fj.liftB numUnaryOps[o], @.beh)

  handler.left = (o, r) ->
    h = Proxy.unProxy secret, r
    if h
      reactive (fj.liftB numBinaryOps[o], @.beh, h.beh)
    else
      reactive (fj.liftB numBinaryOps[o], @.beh, r)
  handler.right = (o, l) ->
    reactive (fj.liftB numBinaryOps[o], l, @.beh)

  p = Proxy.create handler, null, secret

  p.set = (n) ->
    h = Proxy.unProxy secret, this
    h.beh.sendBehavior n
  p.curr = ->
    h = Proxy.unProxy secret, this
    h.beh.valueNow()
  p.if = (tru, fls) ->
    h = Proxy.unProxy secret, this
    reactive h.beh.ifB tru, fls

  p
reactive = reactive.use "self"

root.reactive :: (Any) -> Reactive
root.reactive = reactive