require('../../src/loadVirt').patch()
fj = require "../../lib/extensions/flapjax"
frp = require "../../lib/extensions/frp"

id = (x) -> x

test "basic usage of core flapjax", ->
  # n = fj.createNode [], id
  # console.log n
  nowB = fj.timerB 1000
  time = nowB.valueNow()
  console.log time
  fj.disableTimer nowB
 
test "flapjax via virtual values for basic numbers and bools", ->
  x = frp.reactive 5
  react_bool = frp.reactive true
  y = x + 5
  a = 5 + x
  z = x + y
  min = -x

  isfive = x is 5

  ok (x.curr() is 5), "x is 5"
  ok (y.curr() is 10), "y is 10"
  ok (a.curr() is 10), "a is 10"
  ok (z.curr() is 15), "z is 15"
  ok (min.curr() is -5), "min is -5"
  ok (isfive.curr() is true), "isfive is true"
  x.set 10
  ok (x.curr() is 10), "x is 10"
  ok (y.curr() is 15), "y is 15"
  ok (a.curr() is 15), "a is 15"
  ok (z.curr() is 25), "z is 25"  
  ok (min.curr() is -10), "min is -10"
  ok (isfive.curr() is false), "isfive is false"

test "flapjax via virtual values for conditionals", ->
  x = frp.reactive 5

  # if x is 5
  #   res = true
  # else
  #   res = false

  res = (x is 5).if true, false
  
  ok (res.curr() is true)
  x.set 10
  ok (res.curr() is false)
