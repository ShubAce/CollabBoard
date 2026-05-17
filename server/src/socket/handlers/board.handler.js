export const registerBoardHandlers = (io, socket) => {
	socket.on("join:board", ({ boardId }) => {
		socket.join(`board:${boardId}`);
		socket.currentBoardId = boardId;
	});

	socket.on("leave:board", ({ boardId }) => {
		socket.leave(`board:${boardId}`);
	});
};