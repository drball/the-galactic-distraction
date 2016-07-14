// Created with Squiffy 5.1.0
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
            var incDecRegex = /^([\w]*)\s*([\+\-])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
                rhs = parseFloat(incDecMatch[3]);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);

            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '825c8260cf';
squiffy.story.sections = {
	'_default': {
		'text': "<p><img src=\"https://upload.wikimedia.org/wikipedia/commons/8/86/Jefferson_Park_in_Chicago.JPG\" width=\"300\"></p>\n<p>You&#39;re standing in the park, fuming with anger. Behind you is the city, where your cheating boyfriend lives.</p>\n<p>Actions: </p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Walk back into the city\" role=\"link\" tabindex=\"0\">Walk back into the city</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Explore the park\" role=\"link\" tabindex=\"0\">Explore the park</a></p>",
		'passages': {
			'Walk back into the city': {
				'text': "<p>Go back and face him? After everything he&#39;s done? No smegging way. </p>",
			},
		},
	},
	'Explore the park': {
		'text': "<p>You walk and ponder the argument you just had. </p>\n<p>There&#39;s a <a class=\"squiffy-link link-passage\" data-passage=\"park bench\" role=\"link\" tabindex=\"0\">park bench</a> here, and a stupid plastic garden gnome amongst some flowers.</p>\n<p>It&#39;s now that you realise you desperately need the toilet. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Look around for public toilet\" role=\"link\" tabindex=\"0\">Look around for public toilet</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Pick up gnome\" role=\"link\" tabindex=\"0\">Pick up gnome</a></p>",
		'passages': {
			'Pick up gnome': {
				'text': "<p>You take the gnome and put it under your jacket. never know when a garden gnome will come in handy.</p>",
				'attributes': ["haveGnome"],
			},
			'park bench': {
				'text': "<p>There&#39;s two dirty <a class=\"squiffy-link link-passage\" data-passage=\"tramps\" role=\"link\" tabindex=\"0\">tramps</a> sat there, a man and a woman, holding hands. You think back to the argument with your boyfriend earlier. Cheating bastard. </p>",
			},
			'tramps': {
				'text': "<p>They&#39;re both wearing scraggy clothes, he&#39;s got a dirty sweater that says &quot;Got time?&quot; in large lettering. Not sure what that means. </p>",
			},
		},
	},
	'Look around for public toilet': {
		'text': "<p>You see a metallic cylindrical object the size of a porta-loo and head towards it, ignoring the scientists around it. </p>\n<p>A door slides sideways open as you approach. </p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Examine the porta-loo\" role=\"link\" tabindex=\"0\">Examine the porta-loo</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Look inside\" role=\"link\" tabindex=\"0\">Look inside</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Get inside\" role=\"link\" tabindex=\"0\">Get inside</a></p>",
		'passages': {
			'Examine the porta-loo': {
				'text': "<p>It&#39;s made from a shiny metal which looks pretty thick. </p>\n<p>There&#39;s a few electric panels with <a class=\"squiffy-link link-passage\" data-passage=\"wires\" role=\"link\" tabindex=\"0\">wires</a> poking out.</p>",
			},
			'wires': {
				'text': "<p>You don&#39;t pay any attention to those, you&#39;re really desperate for the toilet now. </p>",
			},
			'Look inside': {
				'text': "<p>There&#39;s no obvious light inside. Perhaps they automatically turn on when you enter? </p>",
			},
		},
	},
	'Get inside': {
		'clear': true,
		'text': "<p>You step inside and the door slides closed behind you, trapping you inside. </p>\n<p>It&#39;s dark apart from a red glow from a digital clock above you. </p>\n<p>There&#39;s a low hum around you and the clock starts to increment faster than it should.</p>\n<p>Actions: </p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Look around the porta-loo\" role=\"link\" tabindex=\"0\">Look around the porta-loo</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Examine clock\" role=\"link\" tabindex=\"0\">Examine clock</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Shout for help\" role=\"link\" tabindex=\"0\">Shout for help</a></p>",
		'passages': {
			'Look around the porta-loo': {
				'text': "<p>This isn&#39;t a porta-loo at all. There&#39;s no sign of a toilet seat. But you do see a <a class=\"squiffy-link link-passage\" data-passage=\"panel with some buttons\" role=\"link\" tabindex=\"0\">panel with some buttons</a>. </p>",
			},
			'Examine clock': {
				'text': "<p>It&#39;s an LED clock that shows the time and date.</p>",
			},
			'Shout for help': {
				'text': "<p>You shout as loud as you can but nothing happens.</p>",
			},
			'panel with some buttons': {
				'text': "<p>It&#39;s a numeric keypad and a larger button marked &quot;Abort&quot; behind some glass with the words &quot;break in case of emergency&quot;.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Type on the keypad\" role=\"link\" tabindex=\"0\">Type on the keypad</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Break the glass\" role=\"link\" tabindex=\"0\">Break the glass</a></p>",
			},
			'Type on the keypad': {
				'text': "<p>You don&#39;t know what numbers to press, so just jab a few keys. Nothing happens. </p>",
			},
			'Break the glass': {
				'text': "<p>{if haveGnome:\nYou smash the glass using the gnome you picked up earlier.\n}{else:\nThere&#39;s a small metal hammer attached to a chain, you use it to smash the glass.\n}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Press the abort button\" role=\"link\" tabindex=\"0\">Press the abort button</a></p>",
			},
			'@1': {
				'text': "<p>The clock now says it&#39;s just after midnight already, but you&#39;ve only just had lunch. The humming gets louder and the clock speeds up. </p>",
			},
			'@2': {
				'text': "<p>The clock has accelerated and now says it&#39;s next week. That can&#39;t be right? The humming increases and the clock speeds up some more.</p>",
			},
			'@3': {
				'text': "<p>The hum is beginning to get unbearable. The clock is now ticking through years as if they&#39;re seconds. </p>",
			},
			'@4': {
				'text': "<p>You can feel the hum vibrating right through you. The clock is accelerating so much, the numbers are a blur. </p>",
			},
		},
	},
	'Press the abort button': {
		'text': "<p>You press the button hard, and glimpse at the clock. A decade just went past, then another before the clock started to slow. </p>\n<p>The lights flickered and then sudenly everything went dark. Even the clock. </p>\n<p>Actions: </p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Look around\" role=\"link\" tabindex=\"0\">Look around</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Look at the clock\" role=\"link\" tabindex=\"0\">Look at the clock</a></p>",
		'passages': {
			'Look around': {
				'text': "<p>Everything is dark, you can&#39;t see anything.</p>\n<p>What you do notice is the silence compared to the noisy hum from before. </p>",
			},
			'Look at the clock': {
				'text': "<p>The LED display is turned off, but the last year you remember seeing had a lot of nines in it.</p>\n<p>Was this really some sort of time machine? </p>",
			},
			'@2': {
				'text': "<p>The door started to whine, then slide open. The brightness dazzles you. </p>\n<p>Actions:</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Peer through the door\" role=\"link\" tabindex=\"0\">Peer through the door</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Step outside\" role=\"link\" tabindex=\"0\">Step outside</a></p>",
			},
			'Peer through the door': {
				'text': "<p>You can see a shiny granite floor lit by artifial light. You&#39;re definitely not in the park any more.</p>",
			},
		},
	},
	'Step outside': {
		'clear': true,
		'text': "<p>You&#39;re now in a room with many sculptures. </p>\n<p>This is the end of this game, I created this in an evening. If you enjoyed it and want more, tweet me at @ongoingworlds </p>",
		'passages': {
		},
	},
}
})();