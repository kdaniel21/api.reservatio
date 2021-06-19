import express from 'express'

export interface GraphqlContext {
  req: express.Request
  res: express.Response
}
