import path from 'path'
import mjml2html from 'mjml'
import handlebars from 'handlebars'
import fs from 'fs/promises'

const compiledTemplatesCache = new Map<string, any>()

export abstract class BaseTemplate<T> {
  readonly name = this.constructor.name

  protected abstract readonly path: string

  abstract readonly subject: string
  abstract readonly templateData: T

  private compiledHtmlCache: string
  // TODO: Extract to config
  private readonly defaultTemplateData = {
    frontendHost: `http://localhost:4200`,
  }

  async getHtml(): Promise<string> {
    if (!this.compiledHtmlCache) await this.compileHtml()

    return this.compiledHtmlCache
  }

  private async compileHtml(): Promise<void> {
    const isTemplateCached = compiledTemplatesCache.has(this.name)
    const compiledTemplate = isTemplateCached ? compiledTemplatesCache.get(this.name) : await this.compileTemplate()

    const templateData = { ...this.defaultTemplateData, ...this.templateData }
    const mjmlWithInjectedData = compiledTemplate(templateData)

    this.compiledHtmlCache = mjml2html(mjmlWithInjectedData).html
  }

  private async compileTemplate(): Promise<any> {
    const completePath = path.join(__dirname, `templates/${this.path}`)
    const mjmlHtml = await fs.readFile(completePath, 'utf-8')

    const compiledTemplate = handlebars.compile(mjmlHtml)
    compiledTemplatesCache.set(this.name, compiledTemplate)
    return compiledTemplate
  }
}

export type Template<TemplateData = any> = new (templateData: TemplateData) => BaseTemplate<TemplateData>
