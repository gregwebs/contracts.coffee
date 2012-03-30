require 'rubygems'
require 'erb'
require 'fileutils'
require 'rake/testtask'
require 'json'

desc "Build the documentation page"
task :doc do
  source = 'documentation/index.html.erb'
  child = fork { exec "bin/coffee -bcw -o documentation/js documentation/coffee/*.coffee" }
  at_exit { Process.kill("INT", child) }
  Signal.trap("INT") { exit }
  loop do
    mtime = File.stat(source).mtime
    if !@mtime || mtime > @mtime
      rendered = ERB.new(File.read(source)).result(binding)
      File.open('index.html', 'w+') {|f| f.write(rendered) }
    end
    @mtime = mtime
    sleep 1
  end
end

desc "Build coffee-script-source gem"
task :gem do
  require 'rubygems'
  require 'rubygems/package'

  gemspec = Gem::Specification.new do |s|
    s.name      = 'contracts.coffee-source'
    s.version   = JSON.parse(File.read('package.json'))["version"]
    s.date      = Time.now.strftime("%Y-%m-%d")

    s.homepage    = "http://disnetdev.com/contracts.coffee/"
    s.summary     = "The CoffeeScript Compiler with Contracts"
    s.description = <<-EOS
      Contracts.coffee is a dialect of CoffeeScript with built-in support for contracts.
      CoffeeScript is JavaScript without all the embarrassing braces and semicolons.
    EOS

    s.files = [
      'lib/coffee_script/coffee-script.js',
      'lib/coffee_script/source.rb'
    ]

    s.authors           = ['Greg Weber', 'Tim Disney', 'Jeremy Ashkenas']
    s.email             = 'greg@gregweber.info'
    s.rubyforge_project = 'contracts.coffee-source'
  end

  file = File.open("contracts.coffee-source.gem", "w")
  Gem::Package.open(file, 'w') do |pkg|
    pkg.metadata = gemspec.to_yaml

    path = "lib/coffee_script/source.rb"
    contents = <<-ERUBY
module CoffeeScript
  module Source
    def self.bundled_path
      File.expand_path("../coffee-script.js", __FILE__)
    end
  end
end
    ERUBY
    pkg.add_file_simple(path, 0644, contents.size) do |tar_io|
      tar_io.write(contents)
    end

    contents = File.read("extras/coffee-script.js")
    path = "lib/coffee_script/coffee-script.js"
    pkg.add_file_simple(path, 0644, contents.size) do |tar_io|
      tar_io.write(contents)
    end
  end
end
