import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' }

function startsBlock(line: string): boolean {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*(?:-{3,}|\*{3,})\s*$/.test(line)
  )
}

function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```\s*([^\s`]*)/)
    if (fence) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', language: fence[1] ?? '', code: codeLines.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }

    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, '').trim())
        index += 1
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') })
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered)
      const matcher = isOrdered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].match(matcher)
        if (!item) break
        items.push(item[1].trim())
        index += 1
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }

    const paragraphLines = [line.trim()]
    index += 1
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
  }

  return blocks
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))

    if (match[2] && match[3]) {
      const target = match[3].trim()
      nodes.push(
        <Text key={`link-${match.index}`} className='md-link' onClick={() => void Taro.setClipboardData({ data: target })}>
          {match[2]}
        </Text>,
      )
    } else if (match[4]) {
      nodes.push(
        <Text key={`code-${match.index}`} className='md-inline-code'>
          {match[4]}
        </Text>,
      )
    } else if (match[5]) {
      nodes.push(
        <Text key={`bold-${match.index}`} style={{ fontWeight: '600' }}>
          {match[5]}
        </Text>,
      )
    }

    cursor = pattern.lastIndex
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function headingClass(level: number): string {
  if (level === 1) return 'md-heading md-h1'
  if (level === 2) return 'md-heading md-h2'
  if (level === 3) return 'md-heading md-h3'
  return 'md-heading md-h4'
}

export function MarkdownView({ source }: { source: string }) {
  const blocks = parseMarkdown(source)

  return (
    <View className='markdown-view'>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'heading') {
          return (
            <View key={blockIndex} className={headingClass(block.level)}>
              <Text>{renderInline(block.text)}</Text>
            </View>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <View key={blockIndex} className='md-paragraph'>
              <Text>{renderInline(block.text)}</Text>
            </View>
          )
        }

        if (block.type === 'list') {
          return (
            <View key={blockIndex} className='md-list'>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} className='md-list-item'>
                  <Text className='md-list-marker'>{block.ordered ? `${itemIndex + 1}.` : '•'}</Text>
                  <Text style={{ flex: 1 }}>{renderInline(item)}</Text>
                </View>
              ))}
            </View>
          )
        }

        if (block.type === 'code') {
          return (
            <View key={blockIndex} className='md-code'>
              {block.language ? (
                <View className='md-code__lang'>
                  <Text>{block.language}</Text>
                </View>
              ) : null}
              <Text userSelect className='md-code__text'>
                {block.code}
              </Text>
            </View>
          )
        }

        if (block.type === 'quote') {
          return (
            <View key={blockIndex} className='md-quote'>
              <Text>{renderInline(block.text)}</Text>
            </View>
          )
        }

        return <View key={blockIndex} className='md-rule' />
      })}
    </View>
  )
}
