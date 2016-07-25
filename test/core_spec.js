const expect = require('chai').expect;

const testData = require('./data/telegram-messages');

const Mankov = require('../src/index');

const IltaaCommander  = require('./commanders/iltaa-commander');
const logMonitor      = require('./monitors/log-monitor');


describe('Mankov Core', () => {
  let mankov = null;

  before(() => {
    mankov = new Mankov();
  });

  describe('Commanders', () => {
    before(() => {
      mankov.createBot('telegram', 'TestBot', {token: 'ASDF-1'});
      mankov.addCommander(new IltaaCommander());
    });


    it('Handles basic /iltaa-command', () => mankov
      .processEvent(testData.parsedIltaaMessage)
      .then(intents => {
        // NOTE/TODO: this test will be scrapped when functionality is added
        expect(intents.TestBot[0]).to.containSubset({
          action: 'sendMessage',
          text: 'Game of Iltuz',
          targetId: testData.parsedIltaaMessage.userId
        });
      })
    );
  });

  describe.skip('Responders', () => {
    // TODO
  });

  describe('Monitors', () => {
    let monitor = null;

    before(() => {
      monitor = new logMonitor();
      mankov.addMonitor(monitor);
    });

    it('can add a monitor to the core', () => mankov
      .processEvent(testData.parsedIltaaMessage)
      .then(expect(monitor.lastEvent).to.equal(testData.parsedIltaaMessage))
    );

    it.skip('should not crash the core even if there was an error', () => {
      // TODO
    });

  });

  describe('Platforms', () => {

    // Clear platforms before each test
    beforeEach(() => {
      mankov._bots = [];
    });

    it('should give available platforms', () => {
      expect(mankov.getAvailablePlatforms()).to.deep.equal(['telegram', 'irc']);
    });

    it('should be able to create a Telegram bot', (done) => {
      const name = 'TestTGBot';
      const options = { token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' };

      mankov.createBot('telegram', name, options)
      .then((bot) => {

        expect(bot.name).to.equal(name);
        expect(bot.onMessage).to.be.a.function;

        // Platform specific asserts
        expect(bot.client.token).to.equal(options.token);

        done();
      });
    });

    it('should be able to create an IRC bot', (done) => {
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
      const name = 'TestIRCBot';
      const options = {
        server: 'http://example.com',
        nick: 'Mankov'
      };

      // First time should be ok
      expect(mankov.createBot('irc', name, options)).eventually.resolved;

      expect(mankov.createBot('irc', name, options)).eventually.rejectedWith(
        `Bot with name "${name}" has already been created.`
      );
    });

    it('should reject if platform type was not found', () =>
      expect(mankov.createBot('unknownPlatform', {})).eventually.rejected
    );

  });

});