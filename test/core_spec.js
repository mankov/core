const expect = require('chai').expect;
const assert = require('chai').assert;

const tgMock = require('./telegram_mock');
const testData = require('./data/telegram-messages');
const testProfiles = require('./data/platform-profiles');
const eventGenerator = require('./event-generator');

const Mankov = require('../src/index');
const actionCreator = require('../src/action-creators');
const actionTypes = require('../src/action-types');

const telegramPlatform = require('../src/platforms/telegram');

const IltaaCommander  = require('./commanders/iltaa-commander');
const MultiCommander  = require('./commanders/multi-commander');
const MoroResponder   = require('./responders/moro-responder');
const logMonitor      = require('./monitors/log-monitor');

describe('Mankov Core', () => {
  let mankov = null;
  let mock = null;

  afterEach(() => {
    mankov._commanders = [];
    mankov._responders = [];
    mankov._monitors = [];
    mankov._bots = {};
  });

  before(() => {
    mankov = new Mankov();
    mock = new tgMock(testProfiles.telegram.options.token);
  });

  describe('Commanders', () => {

    describe('With single intrest', () => {

      before(() => {
        mankov.addCommander(new IltaaCommander());
      });

      it('handles basic /iltaa-command', (done) => mankov
        .getActions(testData.parsedIltaaMessage)
        .then(actions => {
          expect(actions[0]).to.containSubset({
            type: 'SEND_MESSAGE',
            payload: {
              text: 'Game of Iltuz'
            }
          });
          done();
        })
      );

      it('would give zero actions if commander was not interested', (done) => mankov
        .getActions(testData.parsedRandomNoiseMessage)
        .then(actions => {
          expect(actions).to.be.an.array;
          expect(actions).to.have.length(0);
          done();
        })
      );

    });

    describe('With multiple intrests', () => {

      before(() => {
        mankov.addCommander(new MultiCommander());
      });

      it('which will give a one bid', (done) => mankov
        .getActions(testData.parsedIltaaMessage)
        .then(actions => {
          expect(actions).to.have.length(1);
          expect(actions[0]).to.containSubset({
            type: 'SEND_MESSAGE',
            payload: {
              text: 'You are interesting!'
            }
          });
          done();
        })
      );

      it.skip('which will give two bids', () => {
        // TODO: This is the conflict situation, do these tests
        //       after we figure out how to solve conflicts
      });
    });

  });


  describe('Responders', () => {

    before(() => {
      mankov.addResponder(new MoroResponder(100, 'testimoroprefix'));
    });

    it('responds to message with a keyword', (done) => mankov
      .getActions(eventGenerator.textEvent('juuh moro nääs'))
      .then(actions => {

        expect(actions).to.be.an.array;
        expect(actions).to.have.length(1);

        assert(
          actions[0].payload.text.indexOf('testimoroprefix') >= 0,
          'prefix should´ve been added to end of response action text'
        );
        done();
      })
    );
  });


  describe('Comamnders and Responders', () => {

    before(() => {
      mankov.addCommander(new IltaaCommander());
      mankov.addResponder(new MoroResponder(100, 'testimoroprefix'));
    });

    it('ignores events with no keywords in them', (done) => mankov
      .getActions(eventGenerator.textEvent('no keywords in it'))
      .then(actions => {

        expect(actions).to.be.an.array;
        expect(actions.length).to.equal(0);
        done();
      })
    );
  });

  describe('Monitors', () => {
    let monitor = null;

    before(() => {
      monitor = new logMonitor();
      mankov.addMonitor(monitor);
    });

    it('can add a monitor to the core', () => {
      mankov.sendEventToMonitors(testData.parsedIltaaMessage);
      expect(monitor.lastEvent).to.equal(testData.parsedIltaaMessage);
    });

    it.skip('should not crash the core even if there was an error', () => {
      // TODO
    });

  });

  describe('Platforms', () => {

    it('should give available platforms', () => {
      expect(mankov.platforms).to.deep.equal(['telegram', 'irc']);
    });

    it('should be able to create a Telegram bot', (done) => {
      const profile = testProfiles.telegram;

      mankov.createBot('telegram', profile.name, profile.options)
      .then((bot) => {

        expect(bot.name).to.equal(profile.name);
        expect(bot.onMessage).to.be.a.function;

        // Platform specific asserts
        expect(bot.client.token).to.equal(profile.options.token);

        done();
      });
    });

    it('should be able to create an IRC bot', (done) => {
      // TODO: these could be in a dedicated test file?
      const name = 'TestIRCBot';
      const options = {
        server: 'http://example.com',
        nick: 'Mankov'
      };

      mankov.createBot('irc', name, options)
      .then((bot) => {

        expect(bot.name).to.equal(name);
        expect(bot.onMessage).to.be.a.function;

        // Platform specific asserts
        // ...

        done();
      });
    });

    it('should not allow to create a bot with same name', () => {
      const profile = testProfiles.irc;

      // First time should be ok
      expect(mankov.createBot('irc', profile.name, profile.options)).eventually.resolved;

      expect(mankov.createBot('irc', profile.name, profile.options)).eventually.rejectedWith(
        `Bot with name "${profile.name}" has already been created.`
      );
    });

    it('should reject if platform type was not found', () =>
      expect(mankov.createBot('unknownPlatform', {})).eventually.rejected
    );

    it('should able to emit event to core', (done) => {
      const profile = testProfiles.telegram;

      // Create monitor which we use to validate the result
      let monitor = new logMonitor();
      mankov.addMonitor(monitor);

      mankov.createBot('telegram', profile.name, profile.options)
      .then((bot) => {
        bot.emit('event', testData.parsedIltaaMessage);

        // Wait a bit so emit will have effect
        setTimeout(() => {
          expect(monitor.lastEvent).to.equal(testData.parsedIltaaMessage);
          done();
        }, 10);
      });

    });

    it('should allow user to add own platforms', (done) => {
      mankov.addPlatform(telegramPlatform)
      .then(platform => {
        expect(platform).to.equal(telegramPlatform);
        done();
      }
      );
    });

  });

  describe('Action creator / Actions', () => {

    it('should have the required attributes', () => {
      let action = actionCreator.sendMessage('Test message');
      expect(action).to.have.all.keys(
        'type',
        'target',
        'toBot',
        'payload'
      );
    });

    it('should allow to set target, destination bot and optional options', () => {
      let action = actionCreator.sendMessage('Test message', {
        target: 123456,
        toBot: 'someRandomBot',
        optional: { special: 'value' }
      });

      expect(action).to.containSubset({
        type: actionTypes.SEND_MESSAGE,
        target: 123456,
        toBot: 'someRandomBot',
        payload: {
          text: 'Test message',
          options: { special: 'value' }
        }
      });
    });

    it.skip('should fill the null attributes before sending actions to bots', () => {
      // TODO: this test is ignored for now since _validateActions is merged into
      // executeActions.
      //
      // Find a way to stub the bots[x].handleActions so we could inspect the mapped
      // action with this same code.

      let action = actionCreator.sendMessage('Test message');
      let validatedAction = mankov._validateActions([action], testData.parsedIltaaMessage)[0];

      expect(validatedAction).to.containSubset({
        type: actionTypes.SEND_MESSAGE,
        target: testData.parsedIltaaMessage.userId,
        toBot: testData.parsedIltaaMessage.fromBot,
        payload: {
          text: 'Test message'
        }
      });
    });

  });

});
