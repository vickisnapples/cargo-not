/**
 * @fileoverview The stateless controller functions.
 *
 * @author joseph@cs.utexas.edu (Joe Tessler)
 */

goog.provide('cn.controller');
goog.require('cn.constants');
goog.require('cn.model.Command');
goog.require('cn.model.Game');
goog.require('cn.model.Game');
goog.require('cn.ui.GameUi');
goog.require('goog.dom');
goog.require('goog.net.XhrIo');
goog.require('cn.model.Instruction');
goog.require('cn.LevelData.requiredLevels');

var response;
/**
 * Initializes everything and renders the DOM.
 */
cn.controller.init = function() {
  var game = new cn.model.Game();
  game.id = prompt('Enter your UTEID') || 'unknown';
  var completed = [];
  console.log("start");
  goog.net.XhrIo.send('http://stackem.herokuapp.com/api/v1/users/', function(e) {
      response = e.target.getResponseJson();
      console.log(e.target.getResponseJson());
      console.log(e.target.getResponseJson()['id']);
      game.id = e.target.getResponseJson()['id'];
      completed = e.target.getResponseJson()['completed_problems'];
      console.log(game.id);
      console.log(completed);
      goog.array.forEach(completed, function(c) {
        console.log(c);
        if(cn.LevelData.requiredLevels.indexOf(c) != -1){
          var tab = goog.dom.getElementByClass(cn.constants.REQUIRED_LEVEL_CLASS_NAMES[c]);
          goog.dom.classes.add(tab, cn.constants.COMPLETED_LEVEL_CLASS_NAME);
        }
      });
    }, 'POST', '{"user": { "ut_eid": "'+game.id+'"}}', {'content-type': 'application/json'});

  var ui = new cn.ui.GameUi(game);

  ui.render();
};

var stackInitialized = false;
var last = [];

/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.play = function(game, ui) {
  if (game.level.equals(game.goal)) {
    // TODO(joseph): Handle winning differently.
    var stars = game.getStars();
    console.log(game.levelName);
    if(cn.LevelData.requiredLevels.indexOf(game.levelName) != -1){
      goog.dom.classes.add(goog.dom.getElementByClass("cn_-required_.goog_-tab_-selected_"), cn.constants.COMPLETED_LEVEL_CLASS_NAME);
    }
    game.log.record('won ' + stars + ' stars');
    var xhr = new XMLHttpRequest();
    xhr.open('PATCH', 'http://stackem.herokuapp.com/api/v1/users/'+game.id, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.send('{ "user": { "completed_problems": "'+game.levelName+'"}}');
    alert('You won with ' + stars + ' stars!');
    return;
  }
  // Initialize the stack
  if(ui.programStack.isEmpty() && !stackInitialized) {
    cn.controller.initializeStack(game, ui);
    stackInitialized = true;
    last = [];
  }

  var instruction = game.program.next(game.bot);
  last.push(instruction.command);
  console.log(last[last.length-1]);
  console.log(instruction.command);


  ui.programEditor.highlightExecution();
  ui.programEditor.disableDragDrop();
  if (instruction != null && instruction.command != null)
    if(instruction.isFunctionCall() && last.length > 2) {
      if(last[last.length-1] == instruction.command && last[last.length-2] == instruction.command){
        alert("Infinite loop detected with no commands.");
        return;
      }
    }
    cn.controller.execute(instruction.command, game, ui);
};

cn.controller.execute = function (command, game, ui) {
  switch (command) {
    case cn.model.Command.LEFT:
      cn.controller.moveLeft(game, ui);
      break;
    case cn.model.Command.RIGHT:
      cn.controller.moveRight(game, ui);
      break;
    case cn.model.Command.DOWN:
      cn.controller.moveDown(game, ui);
      break;
    case cn.model.Command.F0:
    case cn.model.Command.F1:
    case cn.model.Command.F2:
    case cn.model.Command.F3:
      cn.controller.play(game, ui);
      break;
    default:
      throw Error('1Animation not implemented for "' + command + '"');
  }
}

cn.controller.rewind = function (commands, game) {
  for(var i = commands.length-1; i >= 0; i--) {
    var command = commands[i].command;
    switch (command) {
      case cn.model.Command.RIGHT:
        game.bot.position--;
        break;
      case cn.model.Command.LEFT:
        game.bot.position++;
        break;
      case cn.model.Command.DOWN:
        var stack = game.level.stacks[game.bot.position];
        if (game.bot.hasCargo()) {
          stack.addCargo(game.bot.detachCargo());
        } else if (stack.size() > 0) {
          game.bot.attachCargo(stack.liftCargo());
        }
        break;
      case cn.model.Command.F0:
      case cn.model.Command.F1:
      case cn.model.Command.F2:
      case cn.model.Command.F3:
        break;
      default:
        throw Error('2Animation not implemented for "' + command + '"');
    }
  }
}

cn.controller.initializeStack = function (game, ui) {
  var stack = [];
  var f = game.program.functions[0];
  for(var i = 0; i < f.length; i++) {
    if(f[i].command != null) {
      stack.push(f[i]);
      console.log(stack.length);
    }
  }
  stack.unshift(new cn.model.Instruction());
  ui.programStack.update(stack);
}

/**
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.pause = function(ui) {
  ui.animatedCanvas.pause();
};


/**
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.resume = function(ui) {
  ui.animatedCanvas.resume();
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.moveLeft = function(game, ui) {
  if (game.bot.position == 0) {
    // TODO(joseph): Add a cleaner error notification.
    alert('Cannot move the bot any further left.');
    return;
  }
  var nextStack = game.level.stacks[game.bot.position - 1];
  ui.animatedCanvas.attachAnimation(
      function() { return game.bot.getX() > nextStack.getX(); },
      function() { game.bot.translate(-game.bot.speed, 0); },
      function() {
        game.bot.setPosition(nextStack.getX(), game.bot.getY());
        game.bot.position--;
        cn.controller.play(game, ui);
      });
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.moveRight = function(game, ui) {
  if (game.bot.position == game.level.stacks.length - 1) {
    // TODO(joseph): Add a cleaner error notification.
    alert('Cannot move the bot any further right.');
    return;
  } 
  var nextStack = game.level.stacks[game.bot.position + 1];

  ui.animatedCanvas.attachAnimation(
      function() { return game.bot.getX() < nextStack.getX(); },
      function() { game.bot.translate(game.bot.speed, 0); },
      function() {
        game.bot.setPosition(nextStack.getX(), game.bot.getY());
        game.bot.position++;
        cn.controller.play(game, ui);
      });
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.moveDown = function(game, ui) {
  var startingY = game.bot.getY();
  var stack = game.level.stacks[game.bot.position];
  ui.animatedCanvas.attachAnimation(
      function() {
        if (game.bot.hasCargo() || stack.size() == 0) {
          return game.bot.getY() < stack.getMaxY() - game.bot.height;
        }
        return game.bot.getInnerY() < stack.getMaxY();
      },
      function() { game.bot.translate(0, game.bot.speed); },
      function() {
        if (game.bot.hasCargo()) {
          stack.addCargo(game.bot.detachCargo());
        } else if (stack.size() > 0) {
          game.bot.attachCargo(stack.liftCargo());
        }
        game.bot.setPosition(
            game.bot.getX(),
            game.bot.hasCargo() || stack.size() == 0 ?
                stack.getMaxY() - game.bot.height :
                stack.getMaxY() + game.bot.getY() - game.bot.getInnerY());
        cn.controller.moveUp(game, ui, startingY);
      });
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 * @param {number} endingY The y value to move the bot to.
 */
cn.controller.moveUp = function(game, ui, endingY) {
  ui.animatedCanvas.attachAnimation(
      function() { return game.bot.getY() > endingY; },
      function() { game.bot.translate(0, -game.bot.speed); },
      function() {
        game.bot.setPosition(game.bot.getX(), endingY);
        cn.controller.play(game, ui);
      });
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {number} f The function to add the command to.
 * @param {number} i The position in the function to add the command to.
 * @param {!cn.model.Command} command The command.
 */
cn.controller.setCommand = function(game, f, i, command) {
  game.log.record('set command [' + f + '][' + i + '] to ' + command);
  game.program.functions[f][i].command = command;
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {number} f The function to remove the command from.
 * @param {number} i The position in the function to remove the command from.
 */
cn.controller.removeCommand = function(game, f, i) {
  game.log.record('removed command [' + f + '][' + i + ']');
  game.program.functions[f][i].command = null;
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {number} f The function to add the condition to.
 * @param {number} i The position in the function to add the condition to.
 * @param {!cn.model.Condition} condition The condition.
 */
cn.controller.setCondition = function(game, f, i, condition) {
  game.log.record('set condition [' + f + '][' + i + '] to ' + condition);
  game.program.functions[f][i].condition = condition;
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {number} f The function to remove the condition from.
 * @param {number} i The position in the function to remove the condition from.
 */
cn.controller.removeCondition = function(game, f, i) {
  game.log.record('removed condition [' + f + '][' + i + ']');
  game.program.functions[f][i].condition = null;
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.reset = function(game, ui) {
  game.reset();
  ui.animatedCanvas.clear();
  ui.animatedCanvas.drawPathModel(game);
  ui.controls.reset();
  ui.programEditor.unhighlightExecution();
  ui.programEditor.enableDragDrop();
  ui.programStack.reset();
  stackInitialized = false;
  last = [];

};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.clearProgram = function(game, ui) {
  game.log.record('cleared registers');
  game.program.clear();
  ui.programEditor.clear();
  ui.programStack.reset();
  stackInitialized = false;
  last = [];
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {number} speed The new bot speed.
 */
cn.controller.setBotSpeed = function(game, speed) {
  game.bot.speed = speed;
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 * @param {string} name The level name.
 * @param {!cn.LevelData} levelData The new bot speed.
 */
cn.controller.loadLevel = function(game, ui, name, levelData) {
  cn.controller.sendLog(game);
  game.loadLevel(levelData, name, ui.programStack);
  ui.goalCanvas.clear();
  ui.goalCanvas.drawPathModel(game.goal);
  ui.conditionToolbox.update(game.levelData.conditionToolbox);
  ui.commandToolbox.update(game.levelData.commandToolbox);
  ui.programEditor.init();
  cn.controller.reset(game, ui);
  game.log.record('loaded level ' + name);
};


/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.showHint = function(game, ui) {
  // TODO(joseph): Use a better UI for alerts.
  //alert(game.levelData.hint);
  ui.toggleHintText(game.levelData.hint);
};

/**
 * @param {!cn.model.Game} game The current game.
 * @param {!cn.ui.GameUi} ui A pointer to the UI.
 */
cn.controller.showHelp = function(game, ui) {
  ui.toggleHelpText();
};

/**
 * @param {!cn.model.Game} game The current game.
 */
cn.controller.sendLog = function(game) {
  // Don't send meaningless logs.
  if (game.log.size() > 3) {
    var xhr = new XMLHttpRequest();
    console.log(game.id);
    xhr.open('PATCH', 'http://stackem.herokuapp.com/api/v1/users/'+game.id, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.send('{ "user": { "log": '+game.log.serialize()+'}}');
  }
  game.log.clear();
};
