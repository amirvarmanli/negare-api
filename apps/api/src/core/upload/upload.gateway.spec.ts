import { UploadGateway, EV_SERVER_PROGRESS, EV_UPLOADED, EV_ERROR, EV_JOINED, EV_LEFT } from './upload.gateway';

describe('UploadGateway', () => {
  let gateway: UploadGateway;
  let toMock: jest.Mock;
  let emitMock: jest.Mock;

  beforeEach(() => {
    gateway = new UploadGateway();
    emitMock = jest.fn();
    toMock = jest.fn().mockReturnValue({ emit: emitMock });
    gateway.server = { to: toMock, emit: emitMock } as any;
  });

  const makeSocket = () => {
    const socket: any = {
      id: 'socket-1',
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };
    return socket;
  };

  it('joins room with valid uploadId and acknowledges once', () => {
    const socket = makeSocket();
    gateway.handleJoin({ uploadId: 'abcd1234' }, socket as any);
    expect(socket.join).toHaveBeenCalledWith('upload:abcd1234');
    expect(socket.emit).toHaveBeenCalledWith(EV_JOINED, { uploadId: 'abcd1234' });

    // rapid re-join should be ignored due to cooldown
    jest.spyOn(Date, 'now').mockReturnValueOnce(Date.now());
    gateway.handleJoin({ uploadId: 'abcd1234' }, socket as any);
    expect(socket.join).toHaveBeenCalledTimes(1);
  });

  it('throws on invalid uploadId during join', () => {
    const socket = makeSocket();
    expect(() => gateway.handleJoin({ uploadId: 'x' }, socket as any)).toThrow();
  });

  it('leaves room and emits confirmation', () => {
    const socket = makeSocket();
    socket.data.uploadId = 'abcd1234';
    gateway.handleLeave({}, socket as any);
    expect(socket.leave).toHaveBeenCalledWith('upload:abcd1234');
    expect(socket.emit).toHaveBeenCalledWith(EV_LEFT, { uploadId: 'abcd1234' });
  });

  it('emits progress events with clamped percent', () => {
    gateway.emitServerProgress({ uploadId: 'abcd1234', sent: 750, total: 1000, percent: 0 });
    expect(toMock).toHaveBeenCalledWith('upload:abcd1234');
    expect(emitMock).toHaveBeenCalledWith(EV_SERVER_PROGRESS, {
      uploadId: 'abcd1234',
      sent: 750,
      total: 1000,
      percent: 75,
    });
  });

  it('emits uploaded event to room', () => {
    gateway.emitUploaded({ uploadId: 'abcd1234', url: 'https://cdn/file', path: 'uploads/file' });
    expect(toMock).toHaveBeenCalledWith('upload:abcd1234');
    expect(emitMock).toHaveBeenCalledWith(EV_UPLOADED, {
      uploadId: 'abcd1234',
      url: 'https://cdn/file',
      path: 'uploads/file',
    });
  });

  it('emits errors to either room or broadcast', () => {
    gateway.emitError({ code: 'INTERNAL' });
    expect(emitMock).toHaveBeenCalledWith(EV_ERROR, { code: 'INTERNAL' });

    gateway.emitError({ code: 'BAD_STATE', uploadId: 'abcd1234' });
    expect(toMock).toHaveBeenCalledWith('upload:abcd1234');
    expect(emitMock).toHaveBeenCalledWith(EV_ERROR, {
      code: 'BAD_STATE',
      uploadId: 'abcd1234',
    });
  });
});
