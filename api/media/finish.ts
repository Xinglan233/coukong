import type { IncomingMessage,ServerResponse } from 'node:http'
import { finishImage,jsonBody,respond,checkOrigin,MediaError } from '../../src/server/media-service'
export default async function finish(req:IncomingMessage,res:ServerResponse){try{if(req.method!=='POST')throw new MediaError('仅支持POST',405);checkOrigin(req);respond(res,undefined,await finishImage(await jsonBody(req)))}catch(e){respond(res,e)}}
