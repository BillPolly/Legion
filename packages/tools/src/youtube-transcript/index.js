const { YoutubeTranscript } = require('youtube-transcript');
const { Tool } = require('../base/base-tool');

class YoutubeTranscriptTool extends Tool {
    constructor() {
        super();
        this.identifier = "youtube_transcript_tool";
        this.name = "Youtube transcript tool";
        this.abilities = ["Can fetch transcript of a Youtube video"];
        this.instructions = ["Fetch the transcript of the video using the fetchTranscript function"];
        this.functions = [{
            name: 'fetchTranscript',
            purpose: 'Fetch the transcription by youtube video id',
            arguments: [{
                name: 'videoId',
                description: 'ID of the youtube video. It can be found in the URL query parameter "v"',
                dataType: "string"
            }],
            response: "The entire transcript of the given youtube video"
        }];

        this.functionMap = {
            'fetchTranscript': this.fetchTranscript.bind(this)
        };
    }

    async fetchTranscript(videoId) {
        const response = await YoutubeTranscript.fetchTranscript(videoId);
        const string = response.map(obj => obj.text).join('\n');
        return string;
    }
}

const youtubeTranscriptTool = new YoutubeTranscriptTool();

module.exports = { youtubeTranscriptTool };