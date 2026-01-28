import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  const hiddenSlugs = ["index"]

  // Fix: Cast fileData.slug to 'string' to satisfy TypeScript
  if (hiddenSlugs.includes(fileData.slug as string)) {
    return null
  }

  // You can remove the old "index" check here because it's included in the list above!

  if (title) {
    return <h1 class={classNames(displayClass, "article-title")}>{title}</h1>
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}
`
export default (() => ArticleTitle) satisfies QuartzComponentConstructor